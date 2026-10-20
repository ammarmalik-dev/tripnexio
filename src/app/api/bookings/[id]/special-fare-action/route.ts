import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { dispatchStatusNotifications } from "@/lib/service-status/engine";
import { saveUploadedFile, UploadValidationError } from "@/lib/storage/local-file-storage";
import { deliverOutput } from "@/lib/outputs/deliver-output";
import { describeError } from "@/lib/api/describe-error";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
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
  z.object({ action: z.literal("UNAVAILABLE"), alternative: alternativeOptionSchema.nullable() }),
  z.object({ action: z.literal("RECORD_PNR") }).extend(recordPnrSchema.shape),
  z.object({ action: z.literal("ISSUE_TICKET") }).extend(issueTicketSchema.shape),
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

  const booking = await db.booking.findUnique({
    where: { id },
    include: { lead: true, customer: true, passengers: { include: { passenger: { select: { fullName: true } } } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.lead.serviceType !== "FLIGHT_SPECIAL_FARE") return jsonError(409, "These actions are only for Special Fare bookings.");
  const actor = { userId: session.id, label: `by ${session.name}` };
  const input = parsed.data;

  try {
    if (input.action === "ISSUE_TICKET") {
      if (!booking.pnr) return jsonError(409, "Record the PNR first — PNR and ticket issuance are separate steps.");
      const bookingPassengerIds = new Set(booking.passengers.map((row) => row.passengerId));
      if (input.passengerIds.some((pid) => !bookingPassengerIds.has(pid))) {
        return jsonError(400, "That passenger isn't on this booking.", { passengerIds: ["Select passengers on this booking."] });
      }
      // Client doc 2026-10-20 (A8) — only the tickets issued so far; each passenger's ticket is tracked on its own.
      const already = await db.document.findMany({ where: { bookingId: id, type: "TICKET_PDF", purgedAt: null }, select: { passengerId: true } });
      const issuedIds = new Set(already.map((row) => row.passengerId));
      if (issuedIds.has(null)) return jsonError(409, "A ticket for every passenger was already delivered.");
      const pending = input.passengerIds.filter((pid) => !issuedIds.has(pid));
      if (pending.length === 0) return jsonError(409, "Those passengers already have their ticket.");
      let fileUrl: string;
      try {
        fileUrl = (await saveUploadedFile(input.fileBase64)).url;
      } catch (error) {
        if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
        throw error;
      }
      const names = booking.passengers.filter((row) => pending.includes(row.passengerId)).map((row) => row.passenger.fullName);
      const coversRest = pending.length + [...issuedIds].length >= booking.passengers.length;
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
          note: `Ticket delivered for ${names.join(", ")}${input.baggage ? `; baggage ${input.baggage}` : ""} (by ${session.name})`,
        });
      });
      // P09 delivery -> once every passenger has a ticket, DELIVERED_TICKET_PDF -> "Ticket Issued"; the customer gets each ticket.
      await deliverOutput({ booking, outputType: "TICKET_PDF", passengerId: pending[0], passengerIds: pending, fileUrl, actor, verb: "issued and delivered" });
      return jsonSuccess({ message: coversRest ? "Ticket delivered — every passenger now has a ticket." : `Ticket delivered for ${names.join(", ")}.` });
    }

    // Client doc 2026-10-20 (A10) — once a ticket is delivered, only an Admin may record the flight as unavailable.
    if (input.action === "UNAVAILABLE" && !session.permissions.includes(ADMIN_FULL_PERMISSION)) {
      const delivered = await db.document.count({ where: { bookingId: id, type: "TICKET_PDF" } });
      if (delivered > 0) return jsonError(409, "A ticket has already been delivered — only an Admin can mark this booking unavailable.");
    }

    const result =
      input.action === "CONFIRM_AVAILABILITY"
        ? await confirmAvailability(id, actor)
        : input.action === "UNAVAILABLE"
          ? await markUnavailable(id, input.alternative, actor)
          : await recordPnr(id, { pnr: input.pnr, vendorReference: input.vendorReference }, actor);
    if (!result.ok) return jsonError(result.httpStatus, result.error);
    await dispatchStatusNotifications(result.notifications);
    return jsonSuccess({ message: result.message });
  } catch (error) {
    console.error("[bookings/special-fare-action]", describeError(error));
    return jsonError(500, "Couldn't complete this action. Please try again.");
  }
}
