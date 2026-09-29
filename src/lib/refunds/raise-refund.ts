import type { Prisma, Refund } from "../../generated/prisma/client";
import { writeAudit } from "../audit/log";
import { paymentTotal } from "../payments/totals";

type Tx = Prisma.TransactionClient;

function roundToPaise(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * P16 — raises a PENDING refund on one SUCCESS payment from inside another
 * operation (e.g. a Special Fare "no alternative" / "lower fare" decision),
 * with no staff calculator involved. Same safety as the refund calculator
 * route: the payment row is locked and the total of non-rejected refunds can
 * never exceed what was paid — the amount is capped to what's left. Still
 * PENDING, so it needs a refunds.approve user to process (P03 rules; a
 * system-raised refund has no raisedByUserId). Returns null when nothing is
 * left to refund.
 */
export async function raiseRefund(
  tx: Tx,
  input: { paymentId: string; amount: number; reason: string; passengerIds?: string[]; raisedByUserId?: string | null; actorLabel: string }
): Promise<Refund | null> {
  await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${input.paymentId} FOR UPDATE`;
  const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment || payment.status !== "SUCCESS") return null;
  const paid = paymentTotal(payment);
  const existing = await tx.refund.aggregate({ where: { paymentId: payment.id, status: { not: "REJECTED" } }, _sum: { refundAmount: true } });
  const left = roundToPaise(paid - Number(existing._sum.refundAmount ?? 0));
  const amount = roundToPaise(Math.min(Math.max(0, input.amount), left));
  if (amount <= 0) return null;

  const refund = await tx.refund.create({
    data: {
      paymentId: payment.id,
      paidAmount: amount,
      cancellationCharge: 0,
      gatewayCharge: 0,
      refundAmount: amount,
      reason: input.reason,
      passengerIds: input.passengerIds ?? [],
      raisedByUserId: input.raisedByUserId ?? null,
      status: "PENDING",
    },
  });
  await writeAudit(tx, {
    entityType: "Refund",
    entityId: refund.id,
    action: "CREATE",
    byUserId: input.raisedByUserId ?? undefined,
    note: `Refund ₹${amount} raised on payment ${payment.id} — ${input.reason} (${input.actorLabel})`,
  });
  return refund;
}

/** P16 — a full refund of everything still refundable on every successful payment of a booking. */
export async function raiseFullRefundForBooking(
  tx: Tx,
  input: { bookingId: string; reason: string; raisedByUserId?: string | null; actorLabel: string }
): Promise<Refund[]> {
  const payments = await tx.payment.findMany({ where: { bookingId: input.bookingId, status: "SUCCESS" }, orderBy: { createdAt: "asc" } });
  const refunds: Refund[] = [];
  for (const payment of payments) {
    const refund = await raiseRefund(tx, { paymentId: payment.id, amount: paymentTotal(payment), reason: input.reason, raisedByUserId: input.raisedByUserId, actorLabel: input.actorLabel });
    if (refund) refunds.push(refund);
  }
  return refunds;
}
