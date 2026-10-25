import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { earlyIssueBlock } from "@/lib/return-ticket/early-hold";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { saveUploadedFile, UploadValidationError } from "@/lib/storage/local-file-storage";
import { OUTPUT_TYPES, OUTPUTS_BY_SERVICE } from "@/lib/outputs/output-types";
import { hasReachedStatusEvent } from "@/lib/service-status/engine";
import { linkedOtbState } from "@/lib/return-ticket/operations";
import { computeReservationExpiry } from "@/lib/bookings/reservation";
import { deliverOutput } from "@/lib/outputs/deliver-output";
import { describeError } from "@/lib/api/describe-error";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const deliverSchema = z.object({
  outputType: z.enum(OUTPUT_TYPES, { error: "Select what you're delivering" }),
  /** The passenger this output belongs to; omit for a booking-level output (e.g. a group package). */
  passengerId: z.string().min(1).nullable().optional(),
  /** Client doc 2026-10-20 (B5) — one file for several passengers. */
  passengerIds: z.array(z.string().min(1)).max(50).optional(),
  fileBase64: z.string().min(1, "Choose a file"),
});

/**
 * P09 — "Upload & Deliver": staff upload the service result for a passenger
 * (or the whole booking). The file is stored as a delivered Document, the
 * booking moves to its service's matching status, and the customer gets
 * WhatsApp + email with a secure download link (tied to this booking's own
 * token). The delivery time is kept on the document.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("documents.edit");
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
  const parsed = deliverSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const booking = await db.booking.findUnique({
    where: { id },
    include: { lead: true, customer: true, passengers: { select: { passengerId: true } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  const actionError = assertServiceAction(session, booking.lead.serviceType, "BOOKING");
  if (actionError) return actionError;

  // Client testing 2026-10-09 (E11) — only this service's own outputs (e.g. no visa PDF on a ticket booking).
  if (!OUTPUTS_BY_SERVICE[booking.lead.serviceType].includes(parsed.data.outputType)) {
    return jsonError(400, "That document type isn't delivered for this service.", { outputType: ["Not available for this service."] });
  }

  // P11 / client doc 2026-10-20 — a visa PDF is delivered once the application is with the embassy;
  // delivering it records the approval ("Visa Approved", or "Approved for partial applicants").
  if ((booking.lead.serviceType === "NEW_VISA" || booking.lead.serviceType === "VISA_CHANGE") && parsed.data.outputType === "VISA_PDF") {
    if (!(await hasReachedStatusEvent(booking.id, "EMBASSY_APPLIED"))) return jsonError(409, "Mark the application Applied to Embassy before delivering the visa.");
  }
  if (booking.lead.serviceType === "VISA_CHANGE" && parsed.data.outputType === "PACKAGE_PDF") {
    return jsonError(409, "Use Generate Package — the Visa Change package is generated from the operational details.");
  }
  // P16 — a Special Fare ticket is issued only after its PNR is recorded (Issue Ticket on the booking).
  if (booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" && parsed.data.outputType === "TICKET_PDF" && !booking.pnr) {
    return jsonError(409, "Record the PNR first, then use Issue Ticket.");
  }
  // P17 — a Return Ticket is never issued before a linked OTB is approved. Client doc 2026-10-20 (B5): uploading the
  // ticket records the reservation as issued if staff hadn't pressed "Issue Reservation" (no separate step needed).
  const issuesReservation =
    booking.lead.serviceType === "RETURN_TICKET" && (parsed.data.outputType === "RESERVATION_PDF" || parsed.data.outputType === "TICKET_PDF") && !booking.reservationIssuedAt;
  if (issuesReservation) {
    // Client 2026-10-25 — never before the day before travel (Admin may override).
    const early = earlyIssueBlock(booking.lead.travelDate, session.permissions.includes(ADMIN_FULL_PERMISSION));
    if (early) return jsonError(409, early);
    const otbState = await linkedOtbState(id);
    if (!otbState.issuanceAllowed) {
      return jsonError(409, `The linked OTB booking ${otbState.otb?.bookingId} isn't approved yet — the ticket can't be issued before OTB approval.`);
    }
  }
  // P13 — the extended visa PDF follows a recorded "Extended" outcome.
  if (booking.lead.serviceType === "VISA_EXTENSION" && parsed.data.outputType === "EXTENDED_VISA_PDF" && booking.extensionOutcome !== "EXTENDED") {
    return jsonError(409, "Record the extension outcome as Extended before delivering the extended visa PDF.");
  }

  const passengerIds = parsed.data.passengerIds?.length ? parsed.data.passengerIds : parsed.data.passengerId ? [parsed.data.passengerId] : [];
  const passengerId = passengerIds[0] ?? null;
  if (passengerIds.some((pid) => !booking.passengers.some((row) => row.passengerId === pid))) {
    return jsonError(400, "That passenger isn't on this booking.", { passengerId: ["Select a passenger on this booking."] });
  }

  let fileUrl: string;
  try {
    fileUrl = (await saveUploadedFile(parsed.data.fileBase64)).url;
  } catch (error) {
    if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
    console.error("[api/bookings/outputs] file save failed", describeError(error));
    return jsonError(500, "Couldn't save the file. Please try again.");
  }

  if (issuesReservation) {
    const issuedAt = new Date();
    await db.booking.update({ where: { id }, data: { reservationIssuedAt: issuedAt, reservationExpiresAt: computeReservationExpiry(issuedAt), reservationExpired: false } });
  }

  const document = await deliverOutput({
    booking,
    outputType: parsed.data.outputType,
    passengerId,
    passengerIds,
    fileUrl,
    actor: { userId: session.id, label: `by ${session.name}` },
  });

  return jsonSuccess(document, 201);
}
