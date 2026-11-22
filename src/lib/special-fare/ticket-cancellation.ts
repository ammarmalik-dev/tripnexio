import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { applyFlowStatus, type StatusNotification } from "../service-status/engine";
import { raiseFullRefundForBooking, raiseRefund } from "../refunds/raise-refund";
import { paymentTotal } from "../payments/totals";
import { getTaxFeeRates } from "../settings/tax-fee-config";

type Tx = Prisma.TransactionClient;
type Actor = { userId?: string; label: string };
type Result = { ok: true; notifications: (StatusNotification | null)[]; message: string; refundIds?: string[]; reschedule?: { bookingId: string; itinerary: string } } | { ok: false; httpStatus: number; error: string };

/**
 * Client doc 16 Nov (A12–A14) — what happens to an ISSUED Special Fare ticket afterwards, stored on
 * Booking.ticketCancellation:
 *  - CUSTOMER: the customer cancels. Requested → Sent to Airlines for Cancellation → Cancellation Quotation (airline fee
 *    + Admin service charge + GST on that charge) → the customer approves (refund of the rest raised) or declines (the
 *    ticket stands) → once the refund completes, Ticket Cancelled.
 *  - AIRLINE_CANCELLED: the airline cancelled the flight — a full refund is raised at once.
 *  - AIRLINE_RESCHEDULED: the airline moved the flight — the customer accepts the new schedule (staff upload the new
 *    ticket) or requests a full refund.
 * Never before the ticket is issued (A13 — before that the normal refund flow applies).
 */
export type TicketFlowKind = "CUSTOMER" | "AIRLINE_CANCELLED" | "AIRLINE_RESCHEDULED";
export type TicketFlowStage = "REQUESTED" | "SENT_TO_AIRLINE" | "QUOTED" | "REFUND_RAISED" | "DECLINED" | "AWAITING_CUSTOMER" | "ACCEPTED_NEW" | "DONE";

export interface TicketFlow {
  kind: TicketFlowKind;
  stage: TicketFlowStage;
  passengerIds: string[];
  reason: string;
  startedAt: string;
  /** CUSTOMER quotation (₹). */
  paidShare?: number;
  airlineFee?: number;
  serviceCharge?: number;
  gst?: number;
  refundable?: number;
  quotedAt?: string;
  /** AIRLINE_RESCHEDULED — the new schedule as staff typed it. */
  newItinerary?: string;
  decision?: "ACCEPT" | "DECLINE" | "REFUND" | null;
  decidedAt?: string | null;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function parseTicketFlow(value: unknown): TicketFlow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const flow = value as Partial<TicketFlow>;
  return flow.kind && flow.stage ? (flow as TicketFlow) : null;
}

/** A flow still under way (a finished or declined one lets a new one start). */
export function isOpenFlow(flow: TicketFlow | null): flow is TicketFlow {
  return !!flow && flow.stage !== "DONE" && flow.stage !== "DECLINED";
}

/**
 * Pure: the cancellation quotation. GST only on the service charge (the airline fee passes through); the customer
 * gets back what they paid for these passengers less every charge, never below zero. The service charge is the
 * company's profit on the cancellation (MIS).
 */
export function cancellationQuote(input: { paidShare: number; airlineFee: number; serviceCharge: number; gstRate: number }) {
  const gst = round(input.serviceCharge * input.gstRate);
  const charges = round(input.airlineFee + input.serviceCharge + gst);
  return { gst, charges, refundable: round(Math.max(0, input.paidShare - charges)), profit: round(input.serviceCharge) };
}

export const ticketFlowActionSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("REQUEST"), passengerIds: z.array(z.string().min(1)).min(1, "Select the passenger(s)"), reason: z.string().trim().min(3, "Give the reason").max(500) }),
  z.object({ step: z.literal("SENT_TO_AIRLINE") }),
  z.object({
    step: z.literal("QUOTE"),
    airlineFee: z.number().min(0, "Can't be negative").max(10_000_000),
    serviceCharge: z.number().min(0, "Can't be negative").max(10_000_000).optional(),
  }),
  z.object({ step: z.literal("AIRLINE_CANCELLED"), reason: z.string().trim().min(3, "Give the airline's reason").max(500) }),
  z.object({ step: z.literal("AIRLINE_RESCHEDULED"), newItinerary: z.string().trim().min(5, "Enter the new schedule").max(1000), reason: z.string().trim().max(500).optional() }),
]);
export type TicketFlowAction = z.infer<typeof ticketFlowActionSchema>;

async function loadBooking(tx: Tx, bookingId: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, ticketCancellation: true, passengers: { select: { passengerId: true, outcome: true } }, lead: { select: { serviceType: true } } },
  });
  if (!booking) return null;
  const tickets = await tx.document.findMany({ where: { bookingId, type: "TICKET_PDF", purgedAt: null }, select: { passengerId: true } });
  const ticketed = new Set(tickets.map((doc) => doc.passengerId));
  const active = booking.passengers.filter((row) => row.outcome !== "CANCELLED" && row.outcome !== "REJECTED");
  const ticketedIds = active.filter((row) => ticketed.has(null) || ticketed.has(row.passengerId)).map((row) => row.passengerId);
  return { booking, flow: parseTicketFlow(booking.ticketCancellation), ticketedIds, activeCount: active.length };
}

async function save(tx: Tx, bookingId: string, flow: TicketFlow) {
  await tx.booking.update({ where: { id: bookingId }, data: { ticketCancellation: flow as unknown as Prisma.InputJsonValue } });
}

/** What these passengers paid: the booking's received payments (less refunds already raised), shared by passenger. */
async function paidShareFor(tx: Tx, bookingId: string, passengers: number, activePassengers: number): Promise<number> {
  const payments = await tx.payment.findMany({ where: { bookingId, status: "SUCCESS" }, select: { id: true, amount: true, gstAmount: true, gatewayFee: true, couponDiscount: true } });
  const paid = payments.reduce((sum, payment) => sum + paymentTotal(payment), 0);
  const raised = await tx.refund.aggregate({ where: { payment: { bookingId }, status: { not: "REJECTED" } }, _sum: { refundAmount: true } });
  const left = Math.max(0, paid - Number(raised._sum.refundAmount ?? 0));
  return round(activePassengers > 0 ? (left * passengers) / activePassengers : left);
}

export async function ticketCancellationServiceCharge(): Promise<number> {
  const config = await db.refundConfig.findUnique({ where: { serviceType: "FLIGHT_SPECIAL_FARE" }, select: { ticketCancellationServiceCharge: true } });
  return Number(config?.ticketCancellationServiceCharge ?? 0);
}

const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Staff: one step of the post-ticket flow (see the file comment). */
export async function applyTicketFlowAction(bookingId: string, action: TicketFlowAction, actor: Actor): Promise<Result> {
  const gstRate = action.step === "QUOTE" ? (await getTaxFeeRates()).gstRate : 0;
  const configuredCharge = action.step === "QUOTE" && action.serviceCharge === undefined ? await ticketCancellationServiceCharge() : 0;
  const refundIds: string[] = [];
  const result = await db.$transaction(async (tx): Promise<Result> => {
    const loaded = await loadBooking(tx, bookingId);
    if (!loaded) return { ok: false, httpStatus: 404, error: "Booking not found." };
    const { flow, ticketedIds, activeCount } = loaded;
    const now = new Date().toISOString();

    if (action.step === "REQUEST" || action.step === "AIRLINE_CANCELLED" || action.step === "AIRLINE_RESCHEDULED") {
      // A13 — only an issued ticket can be cancelled / changed; before that the normal refund flow applies.
      if (ticketedIds.length === 0) return { ok: false, httpStatus: 409, error: "No ticket has been issued yet — before ticket issuance use the normal refund (Payments → Initiate Refund)." };
      if (isOpenFlow(flow)) return { ok: false, httpStatus: 409, error: "A ticket cancellation / airline change is already in progress on this booking." };
    }

    if (action.step === "REQUEST") {
      const passengerIds = action.passengerIds.filter((id) => ticketedIds.includes(id));
      if (passengerIds.length !== action.passengerIds.length) return { ok: false, httpStatus: 409, error: "Only passengers with an issued ticket can be cancelled." };
      const next: TicketFlow = { kind: "CUSTOMER", stage: "REQUESTED", passengerIds, reason: action.reason, startedAt: now, decision: null, decidedAt: null };
      await save(tx, bookingId, next);
      const notification = await applyFlowStatus(tx, { bookingId, statusName: "Ticket Cancellation Requested", userId: actor.userId, actorLabel: actor.label, note: `Ticket cancellation requested: ${action.reason}` });
      await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_TICKET_CANCEL_REQUESTED", byUserId: actor.userId, note: `Ticket cancellation requested for ${passengerIds.length} passenger(s): ${action.reason} (${actor.label})` });
      return { ok: true, notifications: [notification], message: "Ticket cancellation requested — send it to the airline next." };
    }

    if (action.step === "SENT_TO_AIRLINE") {
      if (flow?.kind !== "CUSTOMER" || flow.stage !== "REQUESTED") return { ok: false, httpStatus: 409, error: "Request the ticket cancellation first." };
      await save(tx, bookingId, { ...flow, stage: "SENT_TO_AIRLINE" });
      const notification = await applyFlowStatus(tx, { bookingId, statusName: "Sent to Airlines for Cancellation", userId: actor.userId, actorLabel: actor.label, note: "Cancellation sent to the airline" });
      await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_TICKET_CANCEL_SENT", byUserId: actor.userId, note: `Ticket cancellation sent to the airline (${actor.label})` });
      return { ok: true, notifications: [notification], message: "Sent to the airline — enter the airline's cancellation fee to quote the customer." };
    }

    if (action.step === "QUOTE") {
      if (flow?.kind !== "CUSTOMER" || flow.stage !== "SENT_TO_AIRLINE") return { ok: false, httpStatus: 409, error: "Send the cancellation to the airline first — the quotation follows the airline's fee." };
      const serviceCharge = action.serviceCharge ?? configuredCharge;
      const paidShare = await paidShareFor(tx, bookingId, flow.passengerIds.length, activeCount);
      const quote = cancellationQuote({ paidShare, airlineFee: action.airlineFee, serviceCharge, gstRate });
      await save(tx, bookingId, { ...flow, stage: "QUOTED", paidShare, airlineFee: action.airlineFee, serviceCharge, gst: quote.gst, refundable: quote.refundable, quotedAt: now });
      const notification = await applyFlowStatus(tx, {
        bookingId,
        statusName: "Cancellation Quotation Sent",
        userId: actor.userId,
        actorLabel: actor.label,
        note: `Cancellation quotation: airline fee ${money(action.airlineFee)}, service charge ${money(serviceCharge)}, GST ${money(quote.gst)} — refund ${money(quote.refundable)}`,
        inputs: { cancellationCharges: money(quote.charges), estimatedRefund: money(quote.refundable) },
      });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: bookingId,
        action: "FSF_TICKET_CANCEL_QUOTED",
        byUserId: actor.userId,
        note: `Cancellation quotation sent: paid ${money(paidShare)}, airline fee ${money(action.airlineFee)}, service charge ${money(serviceCharge)} (profit), GST ${money(quote.gst)}, refundable ${money(quote.refundable)} (${actor.label})`,
      });
      return { ok: true, notifications: [notification], message: `Cancellation quotation sent — refundable ${money(quote.refundable)}. The customer approves it on their booking page.` };
    }

    if (action.step === "AIRLINE_CANCELLED") {
      // A14 — the airline cancelled: a full refund of what is left, raised at once.
      await save(tx, bookingId, { kind: "AIRLINE_CANCELLED", stage: "REFUND_RAISED", passengerIds: ticketedIds, reason: action.reason, startedAt: now, decision: null, decidedAt: null });
      const notification = await applyFlowStatus(tx, { bookingId, statusName: "Cancelled by Airline", userId: actor.userId, actorLabel: actor.label, note: `Flight cancelled by the airline: ${action.reason}` });
      const refunds = await raiseFullRefundForBooking(tx, { bookingId, reason: `Flight cancelled by the airline — full refund (${action.reason})`, raisedByUserId: actor.userId ?? null, actorLabel: actor.label });
      refundIds.push(...refunds.map((refund) => refund.id));
      await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_CANCELLED_BY_AIRLINE", byUserId: actor.userId, note: `Flight cancelled by the airline (${action.reason}) — full refund raised (${refunds.length}) (${actor.label})` });
      return { ok: true, notifications: [notification], message: "Marked cancelled by the airline — the full refund was raised and needs approval in Refunds.", refundIds };
    }

    // AIRLINE_RESCHEDULED — the customer chooses on their page; the message carries the new schedule.
    await save(tx, bookingId, { kind: "AIRLINE_RESCHEDULED", stage: "AWAITING_CUSTOMER", passengerIds: ticketedIds, reason: action.reason ?? "", startedAt: now, newItinerary: action.newItinerary, decision: null, decidedAt: null });
    await applyFlowStatus(tx, { bookingId, statusName: "Rescheduled by Airline", userId: actor.userId, actorLabel: actor.label, note: `Flight rescheduled by the airline: ${action.newItinerary}`, silent: true });
    await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_RESCHEDULED_BY_AIRLINE", byUserId: actor.userId, note: `Flight rescheduled by the airline — new schedule: ${action.newItinerary} (${actor.label})` });
    return { ok: true, notifications: [], message: "Reschedule sent to the customer — they accept the new flight or request a refund.", reschedule: { bookingId, itinerary: action.newItinerary } };
  });
  if (result.ok && refundIds.length > 0) result.refundIds = refundIds;
  return result;
}

/**
 * Customer (their booking page): approve / decline the cancellation quotation, or accept / refuse the airline's new
 * schedule. Approving the quotation raises the refund of the refundable amount (charges kept on the refund row).
 */
export async function recordTicketFlowDecision(bookingId: string, choice: "ACCEPT" | "DECLINE" | "REFUND"): Promise<Result> {
  const refundIds: string[] = [];
  const actor = { label: "by the customer" };
  const result = await db.$transaction(async (tx): Promise<Result> => {
    const loaded = await loadBooking(tx, bookingId);
    const flow = loaded?.flow ?? null;
    if (!loaded || !flow || flow.decision) return { ok: false, httpStatus: 409, error: "There's nothing waiting for your decision." };
    const decided = { decision: choice, decidedAt: new Date().toISOString() };

    if (flow.kind === "CUSTOMER" && flow.stage === "QUOTED") {
      if (choice === "DECLINE") {
        await save(tx, bookingId, { ...flow, ...decided, stage: "DECLINED" });
        // The ticket stands: the booking goes back to Ticket Issued without another message.
        await applyFlowStatus(tx, { bookingId, statusName: "Ticket Issued", actorLabel: actor.label, note: "Customer declined the cancellation quotation — the ticket stands", silent: true });
        await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_TICKET_CANCEL_DECLINED", note: "Customer declined the cancellation quotation — ticket kept" });
        return { ok: true, notifications: [], message: "You kept your ticket — nothing was cancelled." };
      }
      if (choice !== "ACCEPT") return { ok: false, httpStatus: 400, error: "Approve or decline the cancellation quotation." };
      const notification = await applyFlowStatus(tx, { bookingId, statusName: "Cancellation Quotation Accepted", actorLabel: actor.label, note: `Customer approved the cancellation quotation — refund ${money(flow.refundable ?? 0)}` });
      const primary = await tx.payment.findFirst({ where: { bookingId, status: "SUCCESS" }, orderBy: { createdAt: "asc" } });
      if (primary && (flow.refundable ?? 0) > 0) {
        const refund = await raiseRefund(tx, {
          paymentId: primary.id,
          amount: flow.refundable ?? 0,
          reason: `Ticket cancellation — airline fee ${money(flow.airlineFee ?? 0)}, service charge ${money(flow.serviceCharge ?? 0)}, GST ${money(flow.gst ?? 0)} deducted`,
          passengerIds: flow.passengerIds,
          actorLabel: actor.label,
        });
        if (refund) {
          const charges = round((flow.airlineFee ?? 0) + (flow.serviceCharge ?? 0) + (flow.gst ?? 0));
          await tx.refund.update({ where: { id: refund.id }, data: { cancellationCharge: charges, paidAmount: round((flow.refundable ?? 0) + charges) } });
          refundIds.push(refund.id);
        }
      }
      await save(tx, bookingId, { ...flow, ...decided, stage: "REFUND_RAISED" });
      await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_TICKET_CANCEL_ACCEPTED", note: `Customer approved the cancellation quotation — refund ${money(flow.refundable ?? 0)} raised` });
      return { ok: true, notifications: [notification], message: "Thank you — your cancellation is confirmed and the refund is being processed." };
    }

    if (flow.kind === "AIRLINE_RESCHEDULED" && flow.stage === "AWAITING_CUSTOMER") {
      if (choice === "REFUND") {
        const refunds = await raiseFullRefundForBooking(tx, { bookingId, reason: "Flight rescheduled by the airline — customer requested a refund (full refund)", actorLabel: actor.label });
        refundIds.push(...refunds.map((refund) => refund.id));
        await save(tx, bookingId, { ...flow, ...decided, stage: "REFUND_RAISED" });
        await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_RESCHEDULE_REFUND", note: "Customer refused the airline's new schedule — full refund raised" });
        return { ok: true, notifications: [], message: "Your refund request was raised." };
      }
      if (choice !== "ACCEPT") return { ok: false, httpStatus: 400, error: "Accept the new flight or request a refund." };
      await save(tx, bookingId, { ...flow, ...decided, stage: "ACCEPTED_NEW" });
      await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_RESCHEDULE_ACCEPTED", note: "Customer accepted the airline's new schedule — new ticket to be uploaded" });
      return { ok: true, notifications: [], message: "Thank you — we'll send your updated ticket shortly." };
    }
    return { ok: false, httpStatus: 409, error: "There's nothing waiting for your decision." };
  });
  if (result.ok && refundIds.length > 0) result.refundIds = refundIds;
  return result;
}

/**
 * Called from the refund engine when a refund completes: a customer ticket cancellation whose refund completed ends at
 * "Ticket Cancelled" (its passengers cancelled) instead of the shared "Partially Cancelled". True when it handled it.
 */
export async function completeTicketCancellation(tx: Tx, bookingId: string, refundPassengerIds: string[], actor: { userId?: string; label: string }): Promise<{ handled: boolean; notification: StatusNotification | null }> {
  const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { ticketCancellation: true } });
  const flow = parseTicketFlow(booking?.ticketCancellation);
  if (!flow || flow.kind !== "CUSTOMER" || flow.stage !== "REFUND_RAISED") return { handled: false, notification: null };
  const passengerIds = flow.passengerIds.length > 0 ? flow.passengerIds : refundPassengerIds;
  if (passengerIds.length > 0) {
    await tx.bookingPassenger.updateMany({ where: { bookingId, passengerId: { in: passengerIds }, outcome: null }, data: { outcome: "CANCELLED" } });
  }
  await save(tx, bookingId, { ...flow, stage: "DONE" });
  const notification = await applyFlowStatus(tx, { bookingId, statusName: "Ticket Cancelled", userId: actor.userId, actorLabel: actor.label, note: "Cancellation refund completed — ticket cancelled" });
  await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "FSF_TICKET_CANCELLED", byUserId: actor.userId, note: `Ticket cancelled for ${passengerIds.length} passenger(s) — refund completed (${actor.label})` });
  return { handled: true, notification };
}

/** Customer-safe view of the open step for the payment page (no internal profit figure). */
export function customerTicketFlow(flow: TicketFlow | null) {
  if (!flow || flow.decision || !(flow.stage === "QUOTED" || flow.stage === "AWAITING_CUSTOMER")) {
    return flow && (flow.stage === "REFUND_RAISED" || flow.stage === "ACCEPTED_NEW" || flow.stage === "DONE")
      ? { kind: flow.kind, stage: flow.stage, waiting: false as const, refundable: flow.refundable ?? null, newItinerary: flow.newItinerary ?? null, charges: null }
      : null;
  }
  return {
    kind: flow.kind,
    stage: flow.stage,
    waiting: true as const,
    refundable: flow.refundable ?? null,
    newItinerary: flow.newItinerary ?? null,
    charges:
      flow.kind === "CUSTOMER"
        ? { paid: flow.paidShare ?? 0, airlineFee: flow.airlineFee ?? 0, serviceCharge: flow.serviceCharge ?? 0, gst: flow.gst ?? 0 }
        : null,
  };
}
