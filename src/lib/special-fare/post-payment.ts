import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { setServiceStatusByEvent, type StatusNotification } from "../service-status/engine";
import { raiseFullRefundForBooking, raiseRefund } from "../refunds/raise-refund";
import { paymentTotal } from "../payments/totals";
import { notifyRefundsRaised } from "../staff-notifications/triggers";
import { flightFieldsFromSectors, itinerarySchema, normalizeItinerary, type StoredItinerarySegment } from "../quotations/itinerary";
import { specialFarePaxCounts, specialFareTotals } from "./pax-counts";
import { resolveSectorFlight } from "./sector-flight";
import { bookingDocumentsWhere } from "../documents/document-lead";
import { isOutputType } from "../outputs/output-types";

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

/**
 * Client doc 2026-10-20 (A12) — the alternative is entered like the quote itself: airports from the
 * master (the route is built from them), airline, flight number, times, terminals, fare rules, the new
 * selling price and cost, and the vendor. Client 2026-10-21 — the very same form as the quote: Direct /
 * Connecting sectors, Adult / Child / Infant cost + price and the cancellation / no-show charges.
 */
const optionalAmount = z.number().nonnegative().optional();
export const alternativeOptionSchema = z.object({
  itinerary: itinerarySchema.optional(),
  adultFare: optionalAmount,
  childFare: optionalAmount,
  infantFare: optionalAmount,
  adultVendorCost: optionalAmount,
  childVendorCost: optionalAmount,
  infantVendorCost: optionalAmount,
  cancellationAllowed: z.boolean().optional(),
  cancellationCharge: optionalAmount,
  noShowCharge: optionalAmount,
  // Client doc 2026-10-27 (A7) — the same limits as the quote form, so text that fits a quote fits its alternative.
  customerCancellationPolicy: optionalText(3000),
  airline: optionalText(10),
  flightNumber: optionalText(12),
  fromAirport: optionalText(60),
  toAirport: optionalText(60),
  route: z.string().trim().min(3, "Enter the departure and arrival airports").max(120),
  departTerminal: optionalText(30),
  arriveTerminal: optionalText(30),
  fareRules: optionalText(2000),
  vendorId: optionalText(40),
  vendorName: optionalText(120),
  flightDateTime: optionalText(40),
  arrivalDateTime: optionalText(40),
  baggageAllowance: optionalText(120),
  terminal: optionalText(60),
  reportingTime: optionalText(60),
  fareType: optionalText(80),
  sellingPrice: z.number({ error: "Enter the alternative selling price" }).positive("Enter the alternative selling price"),
  /** Internal only — never shown to the customer. */
  vendorCost: z.number().nonnegative().optional(),
});
export type AlternativeOptionInput = z.infer<typeof alternativeOptionSchema>;

export type AlternativeDirection = "HIGHER" | "LOWER" | "SAME" | "NONE";

export interface AlternativeOffer extends Partial<Omit<AlternativeOptionInput, "vendorCost" | "itinerary">> {
  vendorCost?: number | null;
  itinerary?: StoredItinerarySegment[];
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
    itinerary: offer.itinerary ?? [],
    fareRules: offer.fareRules ?? null,
    cancellationAllowed: offer.cancellationAllowed ?? null,
    cancellationCharge: offer.cancellationCharge ?? null,
    noShowCharge: offer.noShowCharge ?? null,
    customerCancellationPolicy: offer.customerCancellationPolicy ?? null,
    direction: offer.direction,
    difference: offer.difference,
    decision: offer.decision,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** `adminOverride` — client doc 2026-10-27 (A5): an Admin marking a ticketed booking unavailable (reason in `label`). */
type Actor = { userId?: string; label: string; adminOverride?: boolean };
type Result = { ok: true; notifications: (StatusNotification | null)[]; message: string } | { ok: false; httpStatus: number; error: string };

/**
 * Client 2026-10-23 audit (SF_27) — the booking enters "Seat Unavailable" when the flight is marked unavailable, when
 * that status exists and the current status may move there; otherwise nothing changes. Returns its message.
 */
async function throughSeatUnavailable(tx: Tx, bookingId: string, actor: Actor): Promise<StatusNotification | null> {
  const moved = await moveTo(tx, bookingId, "FSF_SEAT_UNAVAILABLE", "Requested flight unavailable at final confirmation", actor);
  return moved.ok ? moved.notification : null;
}

async function moveTo(tx: Tx, bookingId: string, event: Parameters<typeof setServiceStatusByEvent>[1]["event"], note: string, actor: Actor) {
  return setServiceStatusByEvent(tx, { scope: "BOOKING", entityId: bookingId, event, note, userId: actor.userId, actorLabel: actor.label, ...(actor.adminOverride ? { adminOverride: true } : {}) });
}

/**
 * Client doc 2026-10-20 (A12) — once an alternative is the flight the customer flies, its vendor and cost
 * become the booking's (internal margin = new selling price − new cost), audited.
 */
async function applyAlternativeCost(tx: Tx, leadId: string, bookingId: string, offer: { vendorId?: string | null; vendorName?: string | null; vendorCost?: number | null; sellingPrice?: number }, actor: Actor) {
  if (!offer.vendorId && (offer.vendorCost === null || offer.vendorCost === undefined)) return;
  const quotation = await tx.quotation.findFirst({ where: { leadId, isSelected: true }, select: { id: true, vendorId: true } });
  if (!quotation) return;
  const vendor = offer.vendorId ? await tx.vendor.findUnique({ where: { id: offer.vendorId }, select: { id: true } }) : null;
  const cost = offer.vendorCost ?? null;
  await tx.quotation.update({
    where: { id: quotation.id },
    data: {
      ...(vendor ? { vendorId: vendor.id } : {}),
      ...(cost !== null ? { vendorCost: cost, ...(offer.sellingPrice ? { margin: round(offer.sellingPrice - cost) } : {}) } : {}),
    },
  });
  await writeAudit(tx, {
    entityType: "Booking",
    entityId: bookingId,
    action: "FSF_ALTERNATIVE_COST",
    byUserId: actor.userId,
    note: `Alternative flight's vendor${offer.vendorName ? ` ${offer.vendorName}` : ""}${cost !== null ? `, cost ₹${cost}` : ""} recorded on the booking (${actor.label})`,
  });
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
    // Special Fare handover §4 — Payment → Documents Validated → Sent to Airlines: every Government ID must be
    // validated before the booking goes to the airline (client 2026-10-23 audit).
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, leadId: true } });
    if (!booking) return { ok: false as const, httpStatus: 404, error: "Booking not found." };
    const documents = await tx.document.findMany({ where: { ...bookingDocumentsWhere(booking), purgedAt: null }, select: { type: true, status: true } });
    const customerDocuments = documents.filter((document) => !isOutputType(document.type));
    // "Documents are requested/validated when required" (client doc 2026-10-20) — none requested, nothing to wait for.
    if (customerDocuments.some((document) => document.status !== "VERIFIED")) {
      return { ok: false as const, httpStatus: 409, error: "Validate every passenger's Government ID before confirming and sending to the airline." };
    }
    const moved = await moveTo(tx, bookingId, "FSF_AVAILABILITY_CONFIRMED", "Final availability confirmed", actor);
    if (!moved.ok) return moved;
    await tx.booking.update({ where: { id: bookingId }, data: { finalConfirmedAt: new Date() } });
    await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_AVAILABILITY_CONFIRMED", byUserId: actor.userId, note: `Seat/fare availability confirmed after payment (${actor.label})` });
    return { ok: true as const, notifications: [moved.notification], message: "Availability confirmed." };
  });
}

/**
 * Client 2026-10-21 — an alternative entered as sectors + per-passenger rates (the quote form): the route,
 * airline, flight and times come from the sectors and the totals from rates × the booking's travellers,
 * exactly as a quote's are. Looked up before the transaction (no global db inside it).
 */
async function resolveAlternative(bookingId: string, input: AlternativeOptionInput): Promise<Omit<AlternativeOffer, "direction" | "difference" | "offeredAt" | "decision" | "decidedAt"> & { sellingPrice: number }> {
  const { itinerary, ...rest } = input;
  const sectors = itinerary && itinerary.length > 0 ? normalizeItinerary(itinerary) : undefined;
  const flight = sectors ? flightFieldsFromSectors(sectors) : null;
  const lead = await db.booking.findUnique({ where: { id: bookingId }, select: { lead: { select: { details: true, paxCount: true } } } });
  const totals = lead ? specialFareTotals(rest, await specialFarePaxCounts(lead.lead)) : {};
  return {
    ...rest,
    ...(sectors ? { itinerary: sectors } : {}),
    ...(flight
      ? {
          fromAirport: flight.fromAirportCode,
          toAirport: flight.toAirportCode,
          airline: flight.airline ?? null,
          flightNumber: flight.flightNumber ?? null,
          flightDateTime: flight.flightDateTime ?? null,
          arrivalDateTime: flight.arrivalDateTime ?? null,
          departTerminal: sectors?.[0]?.departTerminal ?? null,
          arriveTerminal: sectors?.[sectors.length - 1]?.arriveTerminal ?? null,
          terminal: [sectors?.[0]?.departTerminal, sectors?.[sectors.length - 1]?.arriveTerminal].filter(Boolean).join(" → ") || null,
        }
      : {}),
    sellingPrice: totals.sellingPrice ?? rest.sellingPrice,
    ...(totals.vendorCost !== undefined ? { vendorCost: totals.vendorCost } : {}),
  };
}

/**
 * Staff: the paid flight is unavailable. With an alternative, the fare
 * difference decides the path; without one, a full refund is raised.
 */
export async function markUnavailable(bookingId: string, input: AlternativeOptionInput | null, actor: Actor): Promise<Result> {
  // Client doc 2026-10-27 (A7) — the alternative's airports / airlines come from the masters, as a quote's do.
  if (input?.itinerary && input.itinerary.length > 0) {
    const checked = await resolveSectorFlight(input.itinerary);
    if (!checked.ok) return { ok: false, httpStatus: 400, error: checked.error };
  }
  const alternative = input ? await resolveAlternative(bookingId, input) : null;
  // P22 — refunds raised inside the transaction are announced to refunds.approve staff once it commits.
  const raisedRefundIds: string[] = [];
  const result = await db.$transaction(async (tx): Promise<Result> => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, leadId: true } });
    if (!booking) return { ok: false as const, httpStatus: 404, error: "Booking not found." };
    const now = new Date().toISOString();

    if (!alternative) {
      // Client doc 2026-10-20 — no suitable alternative: a full refund (Refund Pending). The booking passes through
      // "Seat Unavailable" (its alternative message has nothing to offer here, so only Refund Pending's goes out).
      await throughSeatUnavailable(tx, bookingId, actor);
      const moved = await moveTo(tx, bookingId, "REFUND_RAISED", "Flight unavailable — no suitable alternative", actor);
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

    // Client 2026-10-23 audit — the system enters "Seat Unavailable" (SF_27) first.
    const seatNotice = await throughSeatUnavailable(tx, bookingId, actor);

    if (direction === "HIGHER") {
      // The "Alternative Offered" message carries the same alternative and the fare difference, so SF_27 isn't sent too.
      const moved = await moveTo(tx, bookingId, "FSF_ALTERNATIVE_OFFERED", `Alternative ${alternative.route} offered — ₹${difference} more`, actor);
      if (!moved.ok) return moved;
      await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_ALTERNATIVE_OFFERED", byUserId: actor.userId, note: `Flight unavailable; alternative ${alternative.route} at ₹${alternative.sellingPrice} (₹${difference} higher) — customer to choose pay or refund (${actor.label})` });
      return { ok: true as const, notifications: [moved.notification], message: "Alternative offered — the customer chooses to pay the difference or get a refund on their payment page." };
    }

    // Lower or the same fare: the booking proceeds on the alternative; a lower fare's difference is refunded.
    const moved = await moveTo(tx, bookingId, "FSF_AVAILABILITY_CONFIRMED", `Alternative ${alternative.route} confirmed (${direction === "LOWER" ? `₹${-difference} lower` : "same fare"})`, actor);
    if (!moved.ok) return moved;
    await tx.booking.update({ where: { id: bookingId }, data: { finalConfirmedAt: new Date() } });
    await applyAlternativeCost(tx, booking.leadId, bookingId, alternative, actor);
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
      // "Seat Unavailable" tells the customer their flight changed to the alternative, then "Sent to Airlines".
      notifications: [seatNotice, moved.notification],
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
        : await moveTo(tx, bookingId, "REFUND_RAISED", "Customer declined the higher-fare alternative", actor);
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
  const lead = await tx.booking.findUnique({ where: { id: bookingId }, select: { leadId: true } });
  if (lead) await applyAlternativeCost(tx, lead.leadId, bookingId, offer, { label: actorLabel });
  return moved.notification;
}

export const recordPnrSchema = z.object({
  pnr: z.string().trim().min(4, "Enter the PNR").max(20).transform((value) => value.toUpperCase()),
  vendorReference: optionalText(120),
});

/** Staff: the PNR, recorded before ticket issuance (client doc 2026-10-20: a detail, not a status of its own). */
export async function recordPnr(bookingId: string, input: z.infer<typeof recordPnrSchema>, actor: Actor): Promise<Result> {
  return db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { pnr: input.pnr, pnrVendorReference: input.vendorReference, pnrRecordedAt: new Date() } });
    await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_PNR_RECORDED", byUserId: actor.userId, note: `PNR ${input.pnr}${input.vendorReference ? `, vendor ref ${input.vendorReference}` : ""} (${actor.label})` });
    return { ok: true as const, notifications: [], message: "PNR recorded." };
  });
}

/**
 * Client doc 2026-10-20 (A7 / A8) — a ticket file for one or more passengers (only the tickets issued so far);
 * the PNR is the only ticket detail kept (no ticket number / issue time / vendor reference fields).
 */
export const issueTicketSchema = z.object({
  passengerIds: z.array(z.string().min(1)).min(1, "Select the passenger(s) this ticket is for"),
  baggage: optionalText(120),
  fileBase64: z.string().min(1, "Choose the ticket file"),
});
