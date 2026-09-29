import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { autoCompleteTasksForEntity } from "@/lib/tasks/create-task";
import { paymentTotal } from "@/lib/payments/totals";
import { notifyRefundsRaised } from "@/lib/staff-notifications/triggers";
import { protectionPlanRefundDecisionSchema } from "@/lib/validation/protection-plan-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * P12 — manager/admin decision on a plan in refund review (refunds.approve).
 * Approve raises a PENDING Refund for the plan amount on the payment that
 * bought it, with the decider as `raisedByUserId` — so under the P03 rules a
 * different approver must move that Refund to PROCESSING/COMPLETED, and the
 * per-payment cap still applies. The plan then follows the Refund's status.
 * Reject closes it with the note.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("refunds.approve");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = protectionPlanRefundDecisionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { decision, note } = parsed.data;

  const plan = await db.protectionPlan.findUnique({
    where: { id },
    include: { passenger: { select: { fullName: true } }, booking: { include: { lead: { select: { serviceType: true } } } } },
  });
  if (!plan) return jsonError(404, "Protection Plan not found.");
  const scopeError = assertServiceAccess(session, plan.booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (plan.status !== "REFUND_UNDER_REVIEW") {
    return jsonError(409, "Only a Protection Plan in refund review can be decided.");
  }

  if (decision === "REJECT") {
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.protectionPlan.update({ where: { id }, data: { status: "REFUND_REJECTED", decisionNote: note } });
      await writeAudit(tx, {
        entityType: "ProtectionPlan",
        entityId: id,
        action: "REFUND_REJECTED",
        byUserId: session.id,
        note: `REFUND_UNDER_REVIEW -> REFUND_REJECTED: ${note} (by ${session.name})`,
      });
      await autoCompleteTasksForEntity(tx, "ProtectionPlan", id, `Protection Plan refund rejected (by ${session.name})`);
      return result;
    });
    return jsonSuccess(updated);
  }

  // The payment that charged this plan; plans bought before P12 have none linked, so fall back to the booking's latest successful payment.
  const payment = plan.paymentId
    ? await db.payment.findUnique({ where: { id: plan.paymentId } })
    : await db.payment.findFirst({ where: { bookingId: plan.bookingId, status: "SUCCESS" }, orderBy: { createdAt: "desc" } });
  if (!payment || payment.status !== "SUCCESS") {
    return jsonError(409, "No successful payment was found for this Protection Plan, so no refund can be raised.");
  }
  const price = Number(plan.price);
  const paidAmount = paymentTotal(payment);

  const result = await db.$transaction(async (tx) => {
    // Same cap as the refund calculator: refunds on one payment never exceed what was paid.
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;
    const existing = await tx.refund.aggregate({ where: { paymentId: payment.id, status: { not: "REJECTED" } }, _sum: { refundAmount: true } });
    if (Number(existing._sum.refundAmount ?? 0) + price > paidAmount + 0.001) return null;

    const refund = await tx.refund.create({
      data: {
        paymentId: payment.id,
        paidAmount: price,
        cancellationCharge: 0,
        gatewayCharge: 0,
        refundAmount: price,
        reason: `Protection Plan refund — ${plan.passenger.fullName}: ${note}`,
        passengerIds: [plan.passengerId],
        raisedByUserId: session.id,
        status: "PENDING",
      },
    });
    await writeAudit(tx, {
      entityType: "Refund",
      entityId: refund.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Protection Plan refund ₹${price} raised for ${plan.passenger.fullName} on payment ${payment.id} (by ${session.name})`,
    });
    const updated = await tx.protectionPlan.update({
      where: { id },
      data: { status: "REFUND_APPROVED", decisionNote: note, refundAmount: price, refundId: refund.id },
    });
    await writeAudit(tx, {
      entityType: "ProtectionPlan",
      entityId: id,
      action: "REFUND_APPROVED",
      byUserId: session.id,
      note: `REFUND_UNDER_REVIEW -> REFUND_APPROVED, refund ${refund.id} ₹${price}: ${note} (by ${session.name})`,
    });
    await autoCompleteTasksForEntity(tx, "ProtectionPlan", id, `Protection Plan refund approved (by ${session.name})`);
    return { plan: updated, refund };
  });

  if (!result) return jsonError(409, `Refunds on this payment can't exceed the ₹${paidAmount} paid.`);
  await notifyRefundsRaised([result.refund.id]);
  return jsonSuccess(result);
}
