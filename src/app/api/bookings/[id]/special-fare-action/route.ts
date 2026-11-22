import type { NextRequest } from "next/server";
import { applySystemEvent, dispatchStatusNotifications } from "@/lib/service-status/engine";
import { bookingActionBlock } from "@/lib/bookings/action-block";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { writeAudit } from "@/lib/audit/log";
import { saveUploadedFile, UploadValidationError } from "@/lib/storage/local-file-storage";
import { deliverOutput } from "@/lib/outputs/deliver-output";
import { describeError } from "@/lib/api/describe-error";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import type { Prisma } from "@/generated/prisma/client";
import { applyTicketFlowAction, parseTicketFlow, ticketFlowActionSchema } from "@/lib/special-fare/ticket-cancellation";
import { applyFlowStatus } from "@/lib/service-status/engine";
import { notifyRefundsRaised } from "@/lib/staff-notifications/triggers";
import { sendStatusTemplate, statusTemplateByName } from "@/lib/notifications/status-template";
import { checkTicketUpload, describeTicketMismatches, ticketExpectations } from "@/lib/special-fare/ticket-check";
import {
  alternativeOptionSchema,
  confirmAvailability,
  issueTicketSchema,
  markUnavailable,
  recordPnr,
  recordPnrSchema,
} from "@/lib/special-fare/post-payment";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CONFIRM_AVAILABILITY") }),
  z.object({
    action: z.literal("UNAVAILABLE"),
    alternative: alternativeOptionSchema.nullable(),
    /** Client doc 2026-10-27 (A5) — required when an Admin overrides after a ticket was delivered. */
    overrideReason: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal("RECORD_PNR") }).extend(recordPnrSchema.shape),
  z.object({ action: z.literal("ISSUE_TICKET") }).extend(issueTicketSchema.shape),
  // Client doc 16 Nov (A12–A14) — after the ticket: customer cancellation, airline cancellation / reschedule.
  z.object({ action: z.literal("TICKET_FLOW"), flow: ticketFlowActionSchema }),
  z.object({ action: z.literal("RESCHEDULE_TICKET"), fileBase64: z.string().min(1, "Choose the new ticket file") }),
]);

/**
 * P16 — Flight Special Fare post-payment staff actions (Flight_Special_Fare.md
 * §17-20): Confirm Availability, Unavailable (with an alternative option or
 * none), Record PNR, Issue Ticket (client doc 2026-10-20: the ticket file per
 * passenger, PNR only -> P09 delivery -> Ticket Issued once all are issued). Status moves go
 * through the service status engine, so the configured transitions decide
 * what's allowed from the booking's current status.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  // Client doc 2026-10-15 (C6) — only the record's own staff (or a manager / Admin) can act on it.
  const ownershipError = await assertOwnsEntity(auth.session, "booking", id);
  if (ownershipError) return ownershipError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  // Client doc 16 Nov (H3 / H4) — nothing more on a cancelled booking, or while a refund on it is open.
  const actionBlock = await bookingActionBlock(id);
  if (actionBlock) return jsonError(409, actionBlock);

  const booking = await db.booking.findUnique({
    where: { id },
    include: { lead: true, customer: true, passengers: { include: { passenger: { select: { fullName: true } } } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  // Admin handover §1 (client 2026-10-25) — the service-wise "BOOKING" action.
  const actionError = assertServiceAction(session, booking.lead.serviceType, "BOOKING");
  if (actionError) return actionError;
  if (booking.lead.serviceType !== "FLIGHT_SPECIAL_FARE") return jsonError(409, "These actions are only for Special Fare bookings.");
  const actor = { userId: session.id, label: `by ${session.name}` };
  const input = parsed.data;

  try {
    if (input.action === "TICKET_FLOW") {
      const flowResult = await applyTicketFlowAction(id, input.flow, actor);
      if (!flowResult.ok) return jsonError(flowResult.httpStatus, flowResult.error);
      await dispatchStatusNotifications(flowResult.notifications);
      if (flowResult.refundIds?.length) await notifyRefundsRaised(flowResult.refundIds);
      if (flowResult.reschedule) {
        const statusTemplate = await statusTemplateByName("FLIGHT_SPECIAL_FARE", "Rescheduled by Airline");
        if (statusTemplate) {
          await sendStatusTemplate({ event: statusTemplate.event, scope: "BOOKING", entityId: id, statusLabel: statusTemplate.label, extraVariables: { alternative_itinerary: flowResult.reschedule.itinerary } });
        }
      }
      return jsonSuccess({ message: flowResult.message });
    }

    if (input.action === "RESCHEDULE_TICKET") {
      // A14 — the customer accepted the airline's new schedule: the new ticket replaces the old one for every passenger.
      const flow = parseTicketFlow(booking.ticketCancellation);
      if (flow?.kind !== "AIRLINE_RESCHEDULED" || flow.stage !== "ACCEPTED_NEW") return jsonError(409, "Upload the new ticket after the customer accepts the airline's new schedule.");
      let fileUrl: string;
      try {
        fileUrl = (await saveUploadedFile(input.fileBase64)).url;
      } catch (error) {
        if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
        throw error;
      }
      await deliverOutput({ booking, outputType: "TICKET_PDF", passengerId: flow.passengerIds[0] ?? null, passengerIds: flow.passengerIds, fileUrl, actor, verb: "re-issued (airline reschedule) and delivered" });
      await db.$transaction(async (tx) => {
        await tx.booking.update({ where: { id }, data: { ticketIssuedAt: new Date(), ticketCancellation: { ...flow, stage: "DONE" } as unknown as Prisma.InputJsonValue } });
        await applyFlowStatus(tx, { bookingId: id, statusName: "Ticket Issued", userId: session.id, actorLabel: actor.label, note: "New ticket after the airline's reschedule", silent: true });
        await writeAudit(tx, { entityType: "Booking", entityId: id, action: "FSF_RESCHEDULE_TICKET", byUserId: session.id, note: `New ticket uploaded after the airline's reschedule (by ${session.name})` });
      });
      return jsonSuccess({ message: "New ticket delivered to the customer." });
    }

    if (input.action === "ISSUE_TICKET") {
      if (!booking.pnr) return jsonError(409, "Record the PNR first — PNR and ticket issuance are separate steps.");
      // Client doc 2026-10-27 (A4) — a ticket only for a passenger still travelling (not cancelled / rejected).
      const travelling = booking.passengers.filter((row) => row.outcome !== "CANCELLED" && row.outcome !== "REJECTED");
      const bookingPassengerIds = new Set(travelling.map((row) => row.passengerId));
      if (input.passengerIds.some((pid) => !bookingPassengerIds.has(pid))) {
        return jsonError(400, "That passenger isn't travelling on this booking.", { passengerIds: ["Select passengers on this booking."] });
      }
      // Client doc 2026-10-20 (A8) — only the tickets issued so far; each passenger's ticket is tracked on its own.
      const already = await db.document.findMany({ where: { bookingId: id, type: "TICKET_PDF", purgedAt: null }, select: { passengerId: true } });
      const issuedIds = new Set(already.map((row) => row.passengerId));
      if (issuedIds.has(null)) return jsonError(409, "A ticket for every passenger was already delivered.");
      const pending = input.passengerIds.filter((pid) => !issuedIds.has(pid));
      if (pending.length === 0) return jsonError(409, "Those passengers already have their ticket.");
      // Client doc 16 Nov (A6) — the ticket is read and compared with the booking (passenger names, PNR, route, date)
      // before it is saved; a difference blocks the upload with a clear message. Admin may override an OCR misread.
      const pendingNames = booking.passengers.filter((row) => pending.includes(row.passengerId)).map((row) => row.passenger.fullName);
      const ticketCheck = await checkTicketUpload(input.fileBase64, await ticketExpectations(booking.leadId, booking.pnr, pendingNames));
      const overrideCheck = Boolean(input.overrideTicketCheckReason) && session.permissions.includes(ADMIN_FULL_PERMISSION);
      if (ticketCheck.mismatches.length > 0 && !overrideCheck) {
        return jsonError(422, describeTicketMismatches(ticketCheck.mismatches), { fileBase64: ticketCheck.mismatches.map((item) => `${item.field}: ticket "${item.ticket}" vs booking "${item.expected}"`) });
      }
      let fileUrl: string;
      try {
        fileUrl = (await saveUploadedFile(input.fileBase64)).url;
      } catch (error) {
        if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
        throw error;
      }
      const names = booking.passengers.filter((row) => pending.includes(row.passengerId)).map((row) => row.passenger.fullName);
      // Ticket Issued only once every passenger still travelling has a ticket (A4).
      const coversRest = travelling.every((row) => issuedIds.has(row.passengerId) || pending.includes(row.passengerId));
      await db.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id },
          data: { ...(coversRest ? { ticketIssuedAt: new Date() } : {}), ...(input.baggage ? { ticketBaggage: input.baggage } : {}) },
        });
        await writeAudit(tx, {
          entityType: "Booking",
          entityId: id,
          action: "FSF_TICKET_ISSUED",
          byUserId: session.id,
          note: `Ticket delivered for ${names.join(", ")}${input.baggage ? `; baggage ${input.baggage}` : ""}${
            ticketCheck.checked ? (ticketCheck.mismatches.length > 0 ? `; ticket check overridden by Admin: ${input.overrideTicketCheckReason}` : "; ticket details matched the booking") : "; ticket not machine-checked (OCR unavailable)"
          } (by ${session.name})`,
        });
      });
      // P09 delivery -> once every passenger has a ticket, DELIVERED_TICKET_PDF -> "Ticket Issued"; the customer gets each ticket.
      await deliverOutput({ booking, outputType: "TICKET_PDF", passengerId: pending[0], passengerIds: pending, fileUrl, actor, verb: "issued and delivered" });
      // Client doc 16 Nov (A5) — only some tickets out: the booking reads "Partially Issued" (CRM and website) until the rest.
      if (!coversRest) {
        const notification = await db.$transaction((tx) =>
          applySystemEvent(tx, { scope: "BOOKING", entityId: id, event: "FSF_PARTIALLY_ISSUED", userId: session.id, actorLabel: `${session.name} (partial ticket issue)` })
        );
        await dispatchStatusNotifications([notification]);
      }
      return jsonSuccess({ message: coversRest ? "Ticket delivered — every passenger now has a ticket." : `Ticket delivered for ${names.join(", ")}.` });
    }

    // Client doc 2026-10-20 (A10) / 2026-10-27 (A5) — once a ticket is delivered, staff can't record the flight as
    // unavailable; only an Admin can, as an audited override with a reason.
    let unavailableActor: { userId?: string; label: string; adminOverride?: boolean } = actor;
    let overrideNote: string | null = null;
    if (input.action === "UNAVAILABLE") {
      const delivered = await db.document.count({ where: { bookingId: id, type: "TICKET_PDF" } });
      if (delivered > 0) {
        if (!session.permissions.includes(ADMIN_FULL_PERMISSION)) {
          return jsonError(409, "A ticket has already been delivered — only an Admin can mark this booking unavailable.");
        }
        const reason = input.overrideReason?.trim() ?? "";
        if (reason.length < 5) {
          return jsonError(400, "A ticket was already delivered — give the reason for this Admin override.", { overrideReason: ["Enter a reason (at least 5 characters)."] });
        }
        unavailableActor = { ...actor, label: `${actor.label} — Admin override after ticket delivery: ${reason}`, adminOverride: true };
        overrideNote = `Marked unavailable after a ticket was delivered: ${reason} (by ${session.name})`;
      }
    }

    const result =
      input.action === "CONFIRM_AVAILABILITY"
        ? await confirmAvailability(id, actor)
        : input.action === "UNAVAILABLE"
          ? await markUnavailable(id, input.alternative, unavailableActor)
          : await recordPnr(id, { pnr: input.pnr, vendorReference: input.vendorReference }, actor);
    if (!result.ok) return jsonError(result.httpStatus, result.error);
    // The override is audited only once the move went through.
    if (overrideNote) await writeAudit(db, { entityType: "Booking", entityId: id, action: "FSF_UNAVAILABLE_OVERRIDE", byUserId: session.id, note: overrideNote });
    await dispatchStatusNotifications(result.notifications);
    return jsonSuccess({ message: result.message });
  } catch (error) {
    console.error("[bookings/special-fare-action]", describeError(error));
    return jsonError(500, "Couldn't complete this action. Please try again.");
  }
}
