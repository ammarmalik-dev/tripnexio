import { z } from "zod";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { setServiceStatusByEvent, type StatusNotification } from "../service-status/engine";
import { raiseFullRefundForBooking } from "../refunds/raise-refund";
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
  const airline = await db.airline.findUnique({ where: { code }, select: { standardProcessingDays: true, urgentProcessingHours: true, urgentPrice: true } });
  if (!airline) return null;
  const rules = resolveAirlineRules(airline, await getOtbGlobalRules());
  const calendar = await getWorkingCalendar("INDIA");
  if (details.processingType === "urgent" && rules.urgentHours !== null) {
    return addWorkingHours(input.paidAt, rules.urgentHours, calendar).toISOString();
  }
  return `${addWorkingDays(input.paidAt, rules.standardDays, calendar)}T${String(calendar.endHour).padStart(2, "0")}:00:00`;
}

const reasonField = z.string().trim().min(5, "Enter the reason (at least 5 characters)").max(500, "Too long");

/** P18 — OTB.md §10-15 staff actions on an OTB booking. */
export const otbActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("STAFF_VERIFICATION") }),
  z.object({ action: z.literal("SUBMIT_TO_AIRLINE") }),
  z.object({ action: z.literal("AIRLINE_PROCESSING") }),
  z.object({ action: z.literal("ADDITIONAL_DOCUMENTS"), reason: reasonField }),
  z.object({ action: z.literal("APPROVE"), otbReference: z.string().trim().min(3, "Enter the OTB PNR / reference").max(40, "Too long") }),
  z.object({ action: z.literal("REJECT"), reason: reasonField }),
  z.object({ action: z.literal("UNABLE_TO_PROCESS"), reason: reasonField }),
]);

export type OtbActionInput = z.infer<typeof otbActionSchema>;

const ACTION_EVENT: Record<OtbActionInput["action"], ServiceStatusSystemEvent> = {
  STAFF_VERIFICATION: "OTB_STAFF_VERIFICATION",
  SUBMIT_TO_AIRLINE: "OTB_SUBMITTED",
  AIRLINE_PROCESSING: "OTB_AIRLINE_PROCESSING",
  ADDITIONAL_DOCUMENTS: "OTB_ADDITIONAL_DOCUMENTS",
  APPROVE: "OTB_APPROVED",
  REJECT: "OTB_REJECTED",
  UNABLE_TO_PROCESS: "OTB_UNABLE_TO_PROCESS",
};

export type OtbActionResult =
  | { ok: true; message: string; notification: StatusNotification | null; approved?: { bookingId: string } }
  | { ok: false; httpStatus: number; error: string };

/**
 * Runs one OTB staff action through the status engine (so the configured
 * transitions decide what's allowed from the current status) and records
 * the facts OTB.md §20 asks for: submission timestamp, approval/rejection
 * timestamp, the OTB PNR/reference, the airline response / staff reason.
 * - APPROVE needs the OTB PNR/reference (mandatory).
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
  return db.$transaction(async (tx) => {
    const note =
      input.action === "APPROVE"
        ? `OTB PNR/reference ${input.otbReference.toUpperCase()}`
        : "reason" in input
          ? input.reason
          : undefined;
    const moved = await setServiceStatusByEvent(tx, {
      scope: "BOOKING",
      entityId: bookingId,
      event: ACTION_EVENT[input.action],
      note,
      userId: actor.userId,
      actorLabel: actor.label,
    });
    if (!moved.ok) return { ok: false, httpStatus: moved.httpStatus, error: moved.error };

    const now = new Date();
    switch (input.action) {
      case "SUBMIT_TO_AIRLINE":
        await tx.booking.update({ where: { id: bookingId }, data: { otbSubmittedAt: now } });
        return { ok: true, message: "Submitted to the airline.", notification: moved.notification };
      case "ADDITIONAL_DOCUMENTS":
        await tx.booking.update({ where: { id: bookingId }, data: { otbOutcomeNote: input.reason } });
        return { ok: true, message: "Marked as additional documents required.", notification: moved.notification };
      case "APPROVE":
        await tx.booking.update({
          where: { id: bookingId },
          data: { pnr: input.otbReference.toUpperCase(), otbDecidedAt: now },
        });
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
    await notifyCustomer({
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
