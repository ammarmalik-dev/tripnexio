import type { Prisma } from "../../generated/prisma/client";

/**
 * The Booking ID for a new booking on this lead: the lead's own reference
 * ("Lead ID becomes Booking ID", CRM.md §5/§7/§19 and Locked Business Rules
 * v2.0 §4 — never a second unrelated id or a placeholder). `bookingId` is
 * unique, so a later booking on the same lead (after a cancelled one) gets
 * "-2", "-3", ... appended to the same reference.
 */
export async function bookingIdForLead(tx: Prisma.TransactionClient, lead: { reference: string | null; id: string }): Promise<string> {
  const base = lead.reference ?? lead.id;
  const taken = new Set(
    (
      await tx.booking.findMany({
        where: { OR: [{ bookingId: base }, { bookingId: { startsWith: `${base}-` } }] },
        select: { bookingId: true },
      })
    ).map((booking) => booking.bookingId)
  );
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}
