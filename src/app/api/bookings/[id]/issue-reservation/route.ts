import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { canIssueReservation, computeReservationExpiry } from "@/lib/bookings/reservation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Return_Verified_Ticket.md §7, locked: "Reservation can be issued up to 24
 * hours before travel. Once issued, the reservation is intended to be valid
 * for the next 24 hours... CRM should store issue time and expected expiry
 * time." Staff-triggered — there's no automatic issuance in M2 (no vendor
 * integration exists to auto-confirm a reservation).
 */
export async function PATCH(_request: Request, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  const booking = await db.booking.findUnique({ where: { id }, include: { lead: true } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.lead.serviceType !== "RETURN_TICKET") {
    return jsonError(409, "Only Return Verified Ticket bookings have an issue-then-expire reservation window.");
  }
  if (booking.reservationIssuedAt) {
    return jsonError(409, "This reservation has already been issued.");
  }

  const travelDateRaw = (booking.lead.details as Record<string, unknown> | null)?.travelDate;
  const travelDate = typeof travelDateRaw === "string" ? new Date(travelDateRaw) : null;
  if (!travelDate || Number.isNaN(travelDate.getTime())) {
    return jsonError(500, "This lead has no valid travel date on record.");
  }
  if (!canIssueReservation(travelDate)) {
    return jsonError(409, "A reservation can only be issued once travel is within 24 hours.");
  }

  const issuedAt = new Date();
  const expiresAt = computeReservationExpiry(issuedAt);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.booking.update({
      where: { id },
      data: { reservationIssuedAt: issuedAt, reservationExpiresAt: expiresAt, reservationExpired: false },
    });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: id,
      action: "RESERVATION_ISSUE",
      byUserId: session.id,
      note: `Reservation issued, valid until ${expiresAt.toISOString()} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
