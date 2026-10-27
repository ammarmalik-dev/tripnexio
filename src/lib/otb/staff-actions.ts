import { z } from "zod";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { setServiceStatusByEvent, type StatusNotification } from "../service-status/engine";
import { raiseFullRefundForBooking } from "../refunds/raise-refund";
import { setBookingVendor, vendorRateProblem } from "../bookings/set-vendor";
import { notifyRefundsRaised } from "../staff-notifications/triggers";
import { usesStatusTemplates } from "../notifications/status-template";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { toWhatsAppId } from "../whatsapp/phone";
import { leadReference } from "../leads/reference";
import { siteConfig } from "../site-config";
import type { ServiceStatusSystemEvent } from "../service-status/events";
import { getOtbGlobalRules, resolveAirlineRules } from "./get-otb-rules";
import { getWorkingCalendar } from "../calendar/get-working-calendar";
import { addWorkingDays, addWorkingHours } from "../calendar/working-calendar";

/**
 * P18 — when the OTB should be done by: the airline's own TAT (per-airline
 * override, else the global OTB timeline) counted in India working days /
 * business hours from payment, skipping weekends and Admin holidays (P09
 * working calendar). Null when unpaid or the airline isn't known.
 */
export async function expectedOtbCompletion(input: { details: unknown; paidAt: Date | null }): Promise<string | null> {
  if (!input.paidAt) return null;
  const details = (input.details ?? {}) as Record<string, unknown>;
  const code = typeof details.airline === "string" ? details.airline : null;
  if (!code) return null;
  const airline = await db.airline.findUnique({ where: { code }, select: { standardProcessingDays: true, urgentProcessingHours: true } });
  if (!airline) return null;
  const rules = resolveAirlineRules(airline, await getOtbGlobalRules(), true);
  const calendar = await getWorkingCalendar("INDIA");
  if (details.processingType === "urgent" && rules.urgentHours !== null) {
    return addWorkingHours(input.paidAt, rules.urgentHours, calendar).toISOString();
  }
  return `${addWorkingDays(input.paidAt, rules.standardDays, calendar)}T${String(calendar.endHour).padStart(2, "0")}:00:00`;
}

const reasonField = z.string().trim().min(5, "Enter the reason (at least 5 characters)").max(500, "Too long");

/** P18 — OTB.md §10-15 staff actions on an OTB booking. */
export const otbActionSchema = z.discriminatedUnion("action", [
  // Client doc 2026-10-27 (C13) — staff name the vendor as they send it; its rate sets the vendor cost (P&L).
  z.object({ action: z.literal("SUBMIT_TO_AIRLINE"), vendorId: z.string().trim().min(1, "Select the vendor") }),
  // Client doc 2026-10-20 — the additional documents the customer uploaded (and staff validated) went to the airline.
  z.object({ action: z.literal("ADDITIONAL_DOCUMENTS") }),
  // Client doc 2026-10-27 (C10) — no OTB PNR / reference: approval is the airline's decision only.
  z.object({ action: z.literal("APPROVE") }),
  z.object({ action: z.literal("REJECT"), reason: reasonField }),
  z.object({ action: z.literal("UNABLE_TO_PROCESS"), reason: reasonField }),
]);

export type OtbActionInput = z.infer<typeof otbActionSchema>;

/** Client doc 2026-10-20 — each action lands on the client's OTB status (Unable to Process = Cancelled, with a full refund). */
const ACTION_EVENT: Record<OtbActionInput["action"], ServiceStatusSystemEvent> = {
  SUBMIT_TO_AIRLINE: "OTB_SUBMITTED",
  ADDITIONAL_DOCUMENTS: "OTB_ADDITIONAL_DOCUMENTS",
  APPROVE: "OTB_APPROVED",
  REJECT: "OTB_REJECTED",
  UNABLE_TO_PROCESS: "CANCELLED",
};

export type OtbActionResult =
  | { ok: true; message: string; notification: StatusNotification | null; approved?: { bookingId: string } }
  | { ok: false; httpStatus: number; error: string };

/**
 * Runs one OTB staff action through the status engine (so the configured
 * transitions decide what's allowed from the current status) and records
 * the facts OTB.md §20 asks for: submission timestamp, approval/rejection
 * timestamp, the OTB PNR/reference, the airline response / staff reason.
 * - SUBMIT_TO_AIRLINE names the vendor (client doc 2026-10-27, C13) — documents validated first (C1, status engine).
 * - APPROVE needs nothing more (the OTB PNR / reference was dropped, C10).
 * - REJECT is the airline's decision — no refund is raised (§14/§16).
 * - UNABLE_TO_PROCESS is TripNexio's own inability before airline
 *   processing — never labelled a rejection — and raises a full refund
 *   (still PENDING, for refunds.approve).
 */
export async function runOtbAction(
  bookingId: string,
  input: OtbActionInput,
  actor: { userId: string; label: string }
): Promise<OtbActionResult> {
  // P22 — refunds raised inside the transaction are announced to refunds.approve staff once it commits.
  const raisedRefundIds: string[] = [];
  // Looked up before the transaction (no global db inside one).
  const vendor =
    input.action === "SUBMIT_TO_AIRLINE" ? await db.vendor.findFirst({ where: { id: input.vendorId, active: true }, select: { id: true, name: true } }) : null;
  if (input.action === "SUBMIT_TO_AIRLINE") {
    if (!vendor) return { ok: false, httpStatus: 400, error: "Select an active vendor." };
    const rateProblem = await vendorRateProblem(db, bookingId, vendor.id);
    if (rateProblem) return { ok: false, httpStatus: 400, error: rateProblem };
  }
  const booking = vendor ? await db.booking.findUnique({ where: { id: bookingId }, select: { leadId: true } }) : null;
  let result: OtbActionResult;
  try {
    result = await db.$transaction(async (tx): Promise<OtbActionResult> => {
      // Client doc 2026-10-27 (C13) — the vendor and its rate first; any failure after it rolls everything back.
      if (vendor && booking) {
        const vendorError = await setBookingVendor(tx, { bookingId, leadId: booking.leadId, vendor, actor: { userId: actor.userId, name: actor.label.replace(/^by /, "") } });
        if (vendorError) throw new OtbActionError(409, vendorError);
      }
      const note = vendor ? `vendor ${vendor.name}` : "reason" in input ? input.reason : undefined;
      const moved = await setServiceStatusByEvent(tx, {
        scope: "BOOKING",
        entityId: bookingId,
        event: ACTION_EVENT[input.action],
        note,
        userId: actor.userId,
        actorLabel: actor.label,
        inputs: "reason" in input ? { reason: input.reason } : undefined,
      });
      if (!moved.ok) {
        if (vendor) throw new OtbActionError(moved.httpStatus, moved.error);
        return { ok: false, httpStatus: moved.httpStatus, error: moved.error };
      }

      const now = new Date();
      switch (input.action) {
        case "SUBMIT_TO_AIRLINE": {
          await tx.booking.update({ where: { id: bookingId }, data: { otbSubmittedAt: now } });
          return { ok: true, message: "Sent to the airline.", notification: moved.notification };
        }
        case "ADDITIONAL_DOCUMENTS":
          return { ok: true, message: "Additional documents marked as sent to the airline.", notification: moved.notification };
        case "APPROVE":
          await tx.booking.update({ where: { id: bookingId }, data: { otbDecidedAt: now } });
          return { ok: true, message: "OTB approved and the customer notified.", notification: moved.notification, approved: { bookingId } };
        case "REJECT":
          await tx.booking.update({ where: { id: bookingId }, data: { otbDecidedAt: now, otbOutcomeNote: input.reason } });
          return { ok: true, message: "OTB marked rejected by the airline (no refund).", notification: moved.notification };
        case "UNABLE_TO_PROCESS": {
          await tx.booking.update({ where: { id: bookingId }, data: { otbDecidedAt: now, otbOutcomeNote: input.reason } });
          const refunds = await raiseFullRefundForBooking(tx, {
            bookingId,
            reason: `OTB — TripNexio unable to process: ${input.reason}`,
            raisedByUserId: actor.userId,
            actorLabel: actor.label,
          });
          raisedRefundIds.push(...refunds.map((refund) => refund.id));
          return {
            ok: true,
            message: refunds.length > 0 ? "Marked unable to process — a refund is pending approval." : "Marked unable to process (nothing paid to refund).",
            notification: moved.notification,
          };
        }
        default:
          return { ok: true, message: "Status updated.", notification: moved.notification };
      }
    });
  } catch (error) {
    if (error instanceof OtbActionError) return { ok: false, httpStatus: error.httpStatus, error: error.message };
    throw error;
  }
  await notifyRefundsRaised(raisedRefundIds);
  return result;
}

/** Thrown inside the transaction so a failed step undoes the vendor already set with it. */
class OtbActionError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * P18 — OTB.md §13 approval message: WhatsApp + email "Your OTB PNR has been
 * approved by the airline." with the reference, plus a Return Verified
 * Ticket offer when the booking has no linked Return Ticket. A linked
 * Return Ticket booking gets a timeline entry that issuance is unblocked.
 * Called after the transaction commits; never throws.
 */
export async function afterOtbApproved(bookingId: string, actorLabel: string): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        pnr: true,
        linkedBookingId: true,
        linkedBooking: { select: { id: true, bookingId: true, lead: { select: { serviceType: true } } } },
        lead: { include: { customer: true } },
      },
    });
    if (!booking) return;
    const hasReturnTicket = booking.linkedBooking?.lead.serviceType === "RETURN_TICKET";
    // Client doc 2026-10-20 — the "OTB Approved" status sends the client's own template instead.
    const statusDriven = await usesStatusTemplates("OTB");
    if (!statusDriven) await notifyCustomer({
      event: NOTIFICATION_EVENTS.OTB_APPROVED,
      emailTo: booking.lead.customer.email,
      whatsappTo: toWhatsAppId(booking.lead.customer.mobile),
      smsTo: toWhatsAppId(booking.lead.customer.mobile),
      variables: {
        customerName: booking.lead.customer.name,
        leadReference: leadReference(booking.lead),
        otbReference: booking.pnr ?? "",
        returnTicketOffer: hasReturnTicket ? "" : `Need a return ticket? Get a Return Verified Ticket: ${siteConfig.url}/services/return-ticket`,
      },
      auditTarget: { entityType: "Booking", entityId: bookingId },
    });
    if (hasReturnTicket && booking.linkedBooking) {
      await db.$transaction((tx) =>
        writeAudit(tx, {
          entityType: "Booking",
          entityId: booking.linkedBooking!.id,
          action: "LINKED_OTB_APPROVED",
          note: `Linked OTB approved (reference ${booking.pnr ?? "—"}) — the reservation can now be issued (${actorLabel})`,
        })
      );
    }
  } catch (error) {
    console.error("[otb] approval follow-up failed", error);
  }
}
