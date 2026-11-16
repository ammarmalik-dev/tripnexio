import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { resubmitRefundSchema } from "@/lib/validation/refund-schema";
import { withReason } from "@/lib/validation/sensitive-action";
import { paymentTotal } from "@/lib/payments/totals";
import { notifyRefundsRaised } from "@/lib/staff-notifications/triggers";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Client doc 16 Nov (H5) — "If the refund is rejected, allow the authorised user to edit the refund amount where there
 * is a mismatch and resubmit for approval." A REJECTED refund gets its corrected amount and goes back to PENDING (the
 * approver then approves or rejects it again). The amount never takes the payment's refunds past what was collected,
 * and the raise steps (booking → Cancellation Requested, approver alert, customer message) run again.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = resubmitRefundSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const refund = await db.refund.findUnique({ where: { id }, include: { payment: { include: { booking: { include: { lead: true } } } } } });
    if (!refund) return jsonError(404, "Refund not found.");
    const ownershipError = await assertOwnsEntity(session, "booking", refund.payment.booking.id);
    if (ownershipError) return ownershipError;
    const scopeError = assertServiceAccess(session, refund.payment.booking.lead.serviceType);
    if (scopeError) return scopeError;
    if (refund.status !== "REJECTED") return jsonError(409, "Only a rejected refund can be corrected and sent again.");

    const amount = Math.round(parsed.data.refundAmount * 100) / 100;
    const collected = paymentTotal(refund.payment);
    const updated = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${refund.paymentId} FOR UPDATE`;
      const others = await tx.refund.aggregate({ where: { paymentId: refund.paymentId, id: { not: id }, status: { not: "REJECTED" } }, _sum: { refundAmount: true } });
      if (Number(others._sum.refundAmount ?? 0) + amount > collected + 0.001) return null;
      const saved = await tx.refund.update({ where: { id }, data: { refundAmount: amount, status: "PENDING", raisedByUserId: session.id } });
      await writeAudit(tx, {
        entityType: "Refund",
        entityId: id,
        action: "RESUBMITTED",
        byUserId: session.id,
        note: withReason(`Rejected refund corrected ₹${Number(refund.refundAmount)} -> ₹${amount} and sent for approval again (by ${session.name})`, parsed.data.reason),
      });
      return saved;
    });
    if (!updated) return jsonError(409, `Refunds on this payment can't exceed the ₹${collected} collected.`, { refundAmount: ["Too high"] });

    await notifyRefundsRaised([id]);
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[api/refunds/[id]]", describeError(error));
    return jsonError(500, "Couldn't send the refund again. Please try again.");
  }
}
