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
 * none), Record PNR, Issue Ticket (ticket number per passenger, issue time,
 * baggage, ticket PDF -> P09 delivery -> Ticket Issued). Status moves go
 * through the service status engine, so the configured transitions decide
 * what's allowed from the booking's current status.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

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
      if (booking.ticketIssuedAt) return jsonError(409, "The ticket was already issued for this booking.");
      const bookingPassengerIds = new Set(booking.passengers.map((row) => row.passengerId));
      const given = new Map(input.tickets.map((ticket) => [ticket.passengerId, ticket.ticketNumber]));
      if ([...given.keys()].some((pid) => !bookingPassengerIds.has(pid)) || [...bookingPassengerIds].some((pid) => !given.get(pid))) {
        return jsonError(400, "Enter a ticket number for every passenger on this booking.", { tickets: ["One ticket number per passenger."] });
      }
      let fileUrl: string;
      try {
        fileUrl = (await saveUploadedFile(input.fileBase64)).url;
      } catch (error) {
        if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
        throw error;
      }
      const issuedAt = input.issuedAt ? new Date(input.issuedAt) : new Date();
      await db.$transaction(async (tx) => {
        for (const row of booking.passengers) {
          await tx.bookingPassenger.update({ where: { id: row.id }, data: { ticketNumber: given.get(row.passengerId) } });
        }
        await tx.booking.update({ where: { id }, data: { ticketIssuedAt: issuedAt, ticketBaggage: input.baggage } });
        await writeAudit(tx, {
          entityType: "Booking",
          entityId: id,
          action: "FSF_TICKET_ISSUED",
          byUserId: session.id,
          note: `Ticket issued ${issuedAt.toISOString()} — ${booking.passengers.map((row) => `${row.passenger.fullName}: ${given.get(row.passengerId)}`).join(", ")}${input.baggage ? `; baggage ${input.baggage}` : ""} (by ${session.name})`,
        });
      });
      // P09 delivery -> DELIVERED_TICKET_PDF -> "Ticket Issued" (completed), customer notified.
      await deliverOutput({ booking, outputType: "TICKET_PDF", passengerId: null, fileUrl, actor, verb: "issued and delivered" });
      return jsonSuccess({ message: "Ticket issued and delivered to the customer." });
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
