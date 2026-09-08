import { db } from "../db";
import { writeAudit } from "../audit/log";
import type { Booking } from "../../generated/prisma/client";

/** Return_Verified_Ticket.md §7, locked: reservation validity after issuance. */
export const RESERVATION_VALIDITY_HOURS = 24;

/**
 * §7: "Reservation can be issued up to 24 hours before travel" — the
 * issuance window opens once travel is within 24h, not before. The spec
 * states no upper bound (e.g. after travel has passed), so none is invented
 * here.
 */
export function canIssueReservation(travelDate: Date, now: Date = new Date()): boolean {
  const windowOpensAt = new Date(travelDate.getTime() - RESERVATION_VALIDITY_HOURS * 60 * 60 * 1000);
  return now >= windowOpensAt;
}

export function computeReservationExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + RESERVATION_VALIDITY_HOURS * 60 * 60 * 1000);
}

export function isReservationExpiredNow(booking: Pick<Booking, "reservationExpiresAt" | "reservationExpired">): boolean {
  if (booking.reservationExpired) return true;
  if (!booking.reservationExpiresAt) return false;
  return booking.reservationExpiresAt.getTime() < Date.now();
}

/**
 * Lazily marks any past-due reservations as expired — same no-cron-job
 * pattern as syncExpiredQuotations() (src/lib/quotations/sync-expiry.ts),
 * run whenever bookings are read. No customer notification here — "reservation
 * expired" isn't in Return_Verified_Ticket.md §25's locked notification list,
 * so none is invented; this only keeps the stored status accurate for staff.
 */
export async function syncExpiredReservations<T extends Booking>(bookings: T[]): Promise<T[]> {
  const dueToExpire = bookings.filter(
    (booking) => !booking.reservationExpired && booking.reservationExpiresAt && booking.reservationExpiresAt.getTime() < Date.now()
  );
  if (dueToExpire.length === 0) return bookings;

  const expiredIds = new Set(dueToExpire.map((booking) => booking.id));

  await db.$transaction(async (tx) => {
    for (const booking of dueToExpire) {
      await tx.booking.update({ where: { id: booking.id }, data: { reservationExpired: true } });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: booking.id,
        action: "RESERVATION_EXPIRE",
        note: "Return Verified Ticket reservation expired automatically — reservationExpiresAt passed",
      });
    }
  });

  // Spread onto the ORIGINAL (possibly richer, e.g. include-shaped) object
  // rather than substituting tx.update()'s plain-Booking return value — a
  // caller passing bookings with relations included (see
  // GET /api/bookings) would otherwise silently lose those relations for
  // any booking that happened to expire during this exact call.
  return bookings.map((booking) => (expiredIds.has(booking.id) ? ({ ...booking, reservationExpired: true } as T) : booking));
}
