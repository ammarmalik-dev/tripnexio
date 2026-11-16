import { db } from "../db";

/**
 * Client doc 16 Nov (H3 / H4 / "Critical Developer Update – Cancellation & Refund Restrictions") — no service work on a
 * booking that is cancelled, or while a refund on it is still open (raised / sent to the gateway): no ticket / visa /
 * package delivery, no embassy / airline step, no document requests, no extra payment. Booking 11026FL112 had a ticket
 * issued after its cancellation; this is the server-side stop. A rejected refund (or a completed partial one) opens the
 * booking again for its active passengers. Returns the reason, or null when the action may go ahead.
 */
export async function bookingActionBlock(bookingId: string): Promise<string | null> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (!booking) return null;
  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
    return "This booking is cancelled — no further processing, deliveries or document requests.";
  }
  const openRefund = await db.refund.count({ where: { status: { in: ["PENDING", "PROCESSING"] }, payment: { bookingId } } });
  if (openRefund > 0) {
    return "A refund / cancellation is under review on this booking — approve or reject it before processing the booking further.";
  }
  return null;
}
