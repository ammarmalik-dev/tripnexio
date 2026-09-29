import { z } from "zod";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import type { Prisma } from "../../generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** OTB's "OTB Approved" status carries this system event (seed + Admin tag, P18). */
const OTB_APPROVED_EVENT = "OTB_APPROVED";

/** P17 — the destination's Admin-set cancellation fee for a Return Ticket lead, or null when none is set. */
export async function returnTicketCancellationFee(details: unknown): Promise<number | null> {
  const countryId = (details as Record<string, unknown> | null)?.destinationCountryId;
  if (typeof countryId !== "string" || !countryId) return null;
  const destination = await db.returnTicketDestination.findUnique({ where: { countryId }, select: { cancellationFee: true } });
  return destination?.cancellationFee != null ? Number(destination.cancellationFee) : null;
}

export interface LinkedOtbState {
  /** The linked OTB booking, when this Return Ticket booking has one. */
  otb: { id: string; bookingId: string; statusName: string | null } | null;
  /** True when there is no linked OTB, or the linked OTB is approved. */
  issuanceAllowed: boolean;
}

/** P17 — CRM.md §15: "Return Ticket issuance is blocked until OTB is approved." */
export async function linkedOtbState(bookingId: string): Promise<LinkedOtbState> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      linkedBooking: {
        select: {
          id: true,
          bookingId: true,
          lead: { select: { serviceType: true } },
          serviceStatus: { select: { name: true, systemEvent: true } },
        },
      },
    },
  });
  const linked = booking?.linkedBooking;
  if (!linked || linked.lead.serviceType !== "OTB") return { otb: null, issuanceAllowed: true };
  return {
    otb: { id: linked.id, bookingId: linked.bookingId, statusName: linked.serviceStatus?.name ?? null },
    issuanceAllowed: linked.serviceStatus?.systemEvent === OTB_APPROVED_EVENT,
  };
}

export type LinkResult = { ok: true } | { ok: false; httpStatus: number; error: string };

/**
 * P17 — links an OTB booking and a Return Verified Ticket booking both ways
 * (Booking.linkedBookingId on each) and writes a cross-timeline audit entry
 * on both. Used by the staff "Link booking" action now and by the combined
 * OTB checkout (P18). Both must belong to the same customer; a booking that
 * is already linked to a different one is refused rather than re-pointed.
 */
export async function linkServiceBookings(
  tx: Tx,
  input: { bookingId: string; otherBookingId: string; userId?: string; actorLabel: string }
): Promise<LinkResult> {
  if (input.bookingId === input.otherBookingId) return { ok: false, httpStatus: 400, error: "A booking can't be linked to itself." };
  const rows = await tx.booking.findMany({
    where: { id: { in: [input.bookingId, input.otherBookingId] } },
    select: { id: true, bookingId: true, customerId: true, linkedBookingId: true, lead: { select: { serviceType: true } } },
  });
  const a = rows.find((row) => row.id === input.bookingId);
  const b = rows.find((row) => row.id === input.otherBookingId);
  if (!a || !b) return { ok: false, httpStatus: 404, error: "Booking not found." };

  const types = new Set([a.lead.serviceType, b.lead.serviceType]);
  if (!(types.has("OTB") && types.has("RETURN_TICKET"))) {
    return { ok: false, httpStatus: 409, error: "Only an OTB booking and a Return Verified Ticket booking can be linked." };
  }
  if (a.customerId !== b.customerId) return { ok: false, httpStatus: 409, error: "Both bookings must belong to the same customer." };
  if (a.linkedBookingId === b.id && b.linkedBookingId === a.id) return { ok: true };
  for (const row of [a, b]) {
    const partner = row === a ? b : a;
    if (row.linkedBookingId && row.linkedBookingId !== partner.id) {
      return { ok: false, httpStatus: 409, error: `${row.bookingId} is already linked to another booking.` };
    }
  }

  await tx.booking.update({ where: { id: a.id }, data: { linkedBookingId: b.id } });
  await tx.booking.update({ where: { id: b.id }, data: { linkedBookingId: a.id } });
  for (const [row, partner] of [
    [a, b],
    [b, a],
  ] as const) {
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: row.id,
      action: "BOOKING_LINKED",
      byUserId: input.userId,
      note: `Linked with ${partner.lead.serviceType === "OTB" ? "OTB" : "Return Verified Ticket"} booking ${partner.bookingId} (${input.actorLabel})`,
    });
  }
  return { ok: true };
}

/** P17 — Return_Verified_Ticket.md §18: vendor / cost / reference / PNR the staff record on the booking. */
export const returnTicketVendorSchema = z.object({
  vendorId: z.string().min(1, "Select a vendor"),
  vendorCost: z.number().min(0, "Can't be negative").max(10_000_000, "That's too large"),
  vendorReference: z.string().trim().max(120, "Too long").optional().default(""),
  pnr: z.string().trim().max(40, "Too long").optional().default(""),
});

export type ReturnTicketVendorInput = z.infer<typeof returnTicketVendorSchema>;
