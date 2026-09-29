import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { setServiceStatusByEvent, type StatusNotification } from "../service-status/engine";
import { raiseFullRefundForBooking, raiseRefund } from "../refunds/raise-refund";
import { paymentTotal } from "../payments/totals";
import { notifyRefundsRaised } from "../staff-notifications/triggers";

type Tx = Prisma.TransactionClient;

/**
 * P16 — Flight Special Fare post-payment operations (Flight_Special_Fare.md
 * §16-20, Locked v2.0 Q18). After payment the booking sits at "Final
 * Confirmation"; staff confirm availability (-> Sent to Airlines) or record
 * the flight as unavailable with an alternative option:
 *   higher fare -> the customer chooses "Pay Additional Amount" (extra
 *                  payment on the same booking) or "Request Refund" — never
 *                  forced into the higher fare;
 *   lower fare  -> the difference refund is raised automatically (still
 *                  needs approval) and the booking proceeds;
 *   none        -> a full refund is raised.
 * PNR and ticket issuance are separate states afterwards.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const alternativeOptionSchema = z.object({
  airline: optionalText(10),
  flightNumber: optionalText(12),
  route: z.string().trim().min(3, "Enter the alternative route").max(120),
  flightDateTime: optionalText(40),
  arrivalDateTime: optionalText(40),
  baggageAllowance: optionalText(80),
  terminal: optionalText(60),
  reportingTime: optionalText(60),
  fareType: optionalText(80),
  sellingPrice: z.number({ error: "Enter the alternative selling price" }).positive("Enter the alternative selling price"),
  /** Internal only — never shown to the customer. */
  vendorCost: z.number().nonnegative().optional(),
});
export type AlternativeOptionInput = z.infer<typeof alternativeOptionSchema>;

export type AlternativeDirection = "HIGHER" | "LOWER" | "SAME" | "NONE";

export interface AlternativeOffer extends Partial<Omit<AlternativeOptionInput, "vendorCost">> {
  vendorCost?: number | null;
  direction: AlternativeDirection;
  /** Alternative selling price minus what was paid for the original fare (before GST/gateway). */
  difference: number;
  offeredAt: string;
  decision: "PAY" | "REFUND" | null;
  decidedAt: string | null;
}

export function parseAlternativeOffer(raw: unknown): AlternativeOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  return typeof data.direction === "string" && typeof data.difference === "number" ? (data as unknown as AlternativeOffer) : null;
}

/** Customer-safe view of an offer (no vendor cost). */
export function customerAlternativeOffer(offer: AlternativeOffer | null) {
  if (!offer || offer.direction === "NONE") return null;
  return {
    airline: offer.airline ?? null,
    flightNumber: offer.flightNumber ?? null,
    route: offer.route ?? null,
    flightDateTime: offer.flightDateTime ?? null,
    arrivalDateTime: offer.arrivalDateTime ?? null,
    baggageAllowance: offer.baggageAllowance ?? null,
    terminal: offer.terminal ?? null,
    reportingTime: offer.reportingTime ?? null,
    fareType: offer.fareType ?? null,
    direction: offer.direction,
    difference: offer.difference,
    decision: offer.decision,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

type Actor = { userId?: string; label: string };
type Result = { ok: true; notifications: (StatusNotification | null)[]; message: string } | { ok: false; httpStatus: number; error: string };

async function moveTo(tx: Tx, bookingId: string, event: Parameters<typeof setServiceStatusByEvent>[1]["event"], note: string, actor: Actor) {
  return setServiceStatusByEvent(tx, { scope: "BOOKING", entityId: bookingId, event, note, userId: actor.userId, actorLabel: actor.label });
}

/** What the customer paid for the original fare, before GST and gateway fee (selected quotation minus coupon). */
async function paidFareBase(tx: Tx, leadId: string): Promise<number | null> {
  const quotation = await tx.quotation.findFirst({ where: { leadId, isSelected: true }, orderBy: { updatedAt: "desc" } });
  if (!quotation) return null;
  return round(Number(quotation.sellingPrice) - Number(quotation.couponDiscount ?? 0));
}

/** Staff: the paid flight/fare is still available — proceed to ticketing. */
export async function confirmAvailability(bookingId: string, actor: Actor): Promise<Result> {
  return db.$transaction(async (tx) => {
    const moved = await moveTo(tx, bookingId, "FSF_AVAILABILITY_CONFIRMED", "Final availability confirmed", actor);
    if (!moved.ok) return moved;
    await tx.booking.update({ where: { id: bookingId }, data: { finalConfirmedAt: new Date() } });
    await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_AVAILABILITY_CONFIRMED", byUserId: actor.userId, note: `Seat/fare availability confirmed after payment (${actor.label})` });
    return { ok: true as const, notifications: [moved.notification], message: "Availability confirmed." };
  });
}

/**
 * Staff: the paid flight is unavailable. With an alternative, the fare
 * difference decides the path; without one, a full refund is raised.
 */
export async function markUnavailable(bookingId: string, alternative: AlternativeOptionInput | null, actor: Actor): Promise<Result> {
  // P22 — refunds raised inside the transaction are announced to refunds.approve staff once it commits.
  const raisedRefundIds: string[] = [];
  const result = await db.$transaction(async (tx): Promise<Result> => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, leadId: true } });
    if (!booking) return { ok: false as const, httpStatus: 404, error: "Booking not found." };
    const now = new Date().toISOString();

    if (!alternative) {
      const moved = await moveTo(tx, bookingId, "FSF_REFUND_PENDING", "Flight unavailable — no suitable alternative", actor);
      if (!moved.ok) return moved;
      const offer: AlternativeOffer = { direction: "NONE", difference: 0, offeredAt: now, decision: null, decidedAt: null };
      await tx.booking.update({ where: { id: bookingId }, data: { alternativeOffer: offer as unknown as Prisma.InputJsonValue } });
      const refunds = await raiseFullRefundForBooking(tx, { bookingId, reason: "Special Fare unavailable — no suitable alternative (full refund)", actorLabel: actor.label });
      raisedRefundIds.push(...refunds.map((refund) => refund.id));
      await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_UNAVAILABLE", byUserId: actor.userId, note: `Flight unavailable, no alternative — full refund raised (${refunds.length} refund(s), ${actor.label})` });
      return { ok: true as const, notifications: [moved.notification], message: "Full refund raised — it needs approval in Refunds." };
    }

    const base = await paidFareBase(tx, booking.leadId);
    if (base === null) return { ok: false as const, httpStatus: 409, error: "This booking has no selected quotation to compare against." };
    const difference = round(alternative.sellingPrice - base);
    const direction: AlternativeDirection = difference > 0.5 ? "HIGHER" : difference < -0.5 ? "LOWER" : "SAME";
    const offer: AlternativeOffer = { ...alternative, direction, difference, offeredAt: now, decision: null, decidedAt: null };
    await tx.booking.update({ where: { id: bookingId }, data: { alternativeOffer: offer as unknown as Prisma.InputJsonValue } });

    if (direction === "HIGHER") {
      const moved = await moveTo(tx, bookingId, "FSF_ALTERNATIVE_OFFERED", `Alternative ${alternative.route} offered — ₹${difference} more`, actor);
      if (!moved.ok) return moved;
      await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_ALTERNATIVE_OFFERED", byUserId: actor.userId, note: `Flight unavailable; alternative ${alternative.route} at ₹${alternative.sellingPrice} (₹${difference} higher) — customer to choose pay or refund (${actor.label})` });
      return { ok: true as const, notifications: [moved.notification], message: "Alternative offered — the customer chooses to pay the difference or get a refund on their payment page." };
    }

    // Lower or the same fare: the booking proceeds on the alternative; a lower fare's difference is refunded.
    const moved = await moveTo(tx, bookingId, "FSF_AVAILABILITY_CONFIRMED", `Alternative ${alternative.route} confirmed (${direction === "LOWER" ? `₹${-difference} lower` : "same fare"})`, actor);
    if (!moved.ok) return moved;
    await tx.booking.update({ where: { id: bookingId }, data: { finalConfirmedAt: new Date() } });
    let note = `Flight unavailable; alternative ${alternative.route} at ₹${alternative.sellingPrice} — same fare, proceeding`;
    if (direction === "LOWER") {
      const primary = await tx.payment.findFirst({ where: { bookingId, status: "SUCCESS" }, orderBy: { createdAt: "asc" } });
      let refundAmount = -difference;
      if (primary) {
        // Refund the difference together with the GST charged on it.
        const net = Number(primary.amount) - Number(primary.couponDiscount ?? 0);
        const gstRate = net > 0 ? Number(primary.gstAmount) / net : 0;
        refundAmount = round(-difference * (1 + gstRate));
        const differenceRefund = await raiseRefund(tx, { paymentId: primary.id, amount: Math.min(refundAmount, paymentTotal(primary)), reason: `Special Fare alternative is ₹${-difference} cheaper — fare difference refund`, actorLabel: actor.label });
        if (differenceRefund) raisedRefundIds.push(differenceRefund.id);
      }
      note = `Flight unavailable; alternative ${alternative.route} at ₹${alternative.sellingPrice} (₹${-difference} lower) — difference refund ₹${refundAmount} raised`;
    }
    await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_ALTERNATIVE_CONFIRMED", byUserId: actor.userId, note: `${note} (${actor.label})` });
    return {
      ok: true as const,
      notifications: [moved.notification],
      message: direction === "LOWER" ? "Alternative confirmed — the fare difference refund was raised and needs approval." : "Alternative confirmed at the same fare.",
    };
  });
  await notifyRefundsRaised(raisedRefundIds);
  return result;
}

/**
 * Customer (their booking's payment page): for a higher-fare alternative,
 * "Pay Additional Amount" or "Request Refund". Returns the amount to charge
 * when they chose to pay — the caller creates the extra payment after this
 * transaction commits (the gateway call is external I/O).
 */
export async function recordCustomerDecision(bookingId: string, decision: "PAY" | "REFUND"): Promise<Result & { payDifference?: number }> {
  // P22 — see markUnavailable.
  const raisedRefundIds: string[] = [];
  const result = await db.$transaction(async (tx): Promise<Result & { payDifference?: number }> => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { alternativeOffer: true } });
    const offer = parseAlternativeOffer(booking?.alternativeOffer);
    if (!offer || offer.direction !== "HIGHER") return { ok: false as const, httpStatus: 409, error: "There's no alternative waiting for your decision." };
    if (offer.decision) return { ok: false as const, httpStatus: 409, error: "You've already made a choice for this alternative." };
    const actor = { label: "by the customer" };
    const moved =
      decision === "PAY"
        ? await moveTo(tx, bookingId, "FSF_ADDITIONAL_PAYMENT_PENDING", `Customer chose to pay the ₹${offer.difference} difference`, actor)
        : await moveTo(tx, bookingId, "FSF_REFUND_PENDING", "Customer declined the higher-fare alternative", actor);
    if (!moved.ok) return moved;
    const updated: AlternativeOffer = { ...offer, decision, decidedAt: new Date().toISOString() };
    await tx.booking.update({ where: { id: bookingId }, data: { alternativeOffer: updated as unknown as Prisma.InputJsonValue } });
    if (decision === "REFUND") {
      const refunds = await raiseFullRefundForBooking(tx, { bookingId, reason: "Customer declined the higher-fare Special Fare alternative (full refund)", actorLabel: "by the customer" });
      raisedRefundIds.push(...refunds.map((refund) => refund.id));
    }
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: bookingId,
      action: "FSF_CUSTOMER_DECISION",
      note: decision === "PAY" ? `Customer chose to pay the ₹${offer.difference} fare difference` : "Customer requested a refund instead of the higher fare (full refund raised)",
    });
    return {
      ok: true as const,
      notifications: [moved.notification],
      message: decision === "PAY" ? "Please complete the additional payment." : "Your refund request was raised.",
      payDifference: decision === "PAY" ? offer.difference : undefined,
    };
  });
  await notifyRefundsRaised(raisedRefundIds);
  return result;
}

/** Called inside the payment-success transaction: an extra payment that settles the higher-fare difference confirms the alternative. */
export async function onSpecialFareExtraPaymentSuccess(tx: Tx, bookingId: string, actorLabel: string): Promise<StatusNotification | null> {
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { alternativeOffer: true } });
  const offer = parseAlternativeOffer(booking?.alternativeOffer);
  if (!offer || offer.direction !== "HIGHER" || offer.decision !== "PAY") return null;
  const moved = await moveTo(tx, bookingId, "FSF_AVAILABILITY_CONFIRMED", "Fare difference paid — alternative confirmed", { label: actorLabel });
  if (!moved.ok) return null;
  await tx.booking.update({ where: { id: bookingId }, data: { finalConfirmedAt: new Date() } });
  return moved.notification;
}

export const recordPnrSchema = z.object({
  pnr: z.string().trim().min(4, "Enter the PNR").max(20).transform((value) => value.toUpperCase()),
  vendorReference: optionalText(120),
});

/** Staff: PNR / vendor reference — a separate state before ticket issuance. */
export async function recordPnr(bookingId: string, input: z.infer<typeof recordPnrSchema>, actor: Actor): Promise<Result> {
  return db.$transaction(async (tx) => {
    const moved = await moveTo(tx, bookingId, "FSF_PNR_RECORDED", `PNR ${input.pnr}`, actor);
    if (!moved.ok) return moved;
    await tx.booking.update({ where: { id: bookingId }, data: { pnr: input.pnr, pnrVendorReference: input.vendorReference, pnrRecordedAt: new Date() } });
    await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_PNR_RECORDED", byUserId: actor.userId, note: `PNR ${input.pnr}${input.vendorReference ? `, vendor ref ${input.vendorReference}` : ""} (${actor.label})` });
    return { ok: true as const, notifications: [moved.notification], message: "PNR recorded." };
  });
}

export const issueTicketSchema = z.object({
  tickets: z.array(z.object({ passengerId: z.string().min(1), ticketNumber: z.string().trim().min(4, "Enter the ticket number").max(30) })).min(1),
  issuedAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter the issue time").optional(),
  baggage: optionalText(120),
  fileBase64: z.string().min(1, "Choose the ticket PDF"),
});
