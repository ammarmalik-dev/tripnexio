import type { NextRequest } from "next/server";
import { updateRefundStatusSchema } from "@/lib/validation/refund-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { withReason } from "@/lib/validation/sensitive-action";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertValidRefundTransition } from "@/lib/refunds/transitions";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { paymentTotal } from "@/lib/payments/totals";
import { syncPlanWithRefund } from "@/lib/protection-plan/lifecycle";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { gatewayForPayment } from "@/lib/payments/accounts";
import { notifyCustomerRefund } from "@/lib/refunds/notify-customer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// CRM.md §21: "CRM raises, Admin approves/rejects — CRM cannot approve its
// own refund." Every status transition here IS the approval action (the
// refund is always created PENDING by POST /api/payments/[id]/refunds,
// which stays gated by the more permissive refunds.edit) — so this route
// requires the dedicated refunds.approve permission (or admin.full), not
// refunds.edit.
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

  const parsed = updateRefundStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const refund = await db.refund.findUnique({
    where: { id },
    include: { payment: { include: { booking: { include: { lead: true } } } } },
  });
  if (!refund) return jsonError(404, "Refund not found.");
  const scopeError = assertServiceAccess(session, refund.payment.booking.lead.serviceType);
  if (scopeError) return scopeError;

  const transitionError = assertValidRefundTransition(refund.status, parsed.data.status);
  if (transitionError) return jsonError(409, transitionError);

  // Maker-checker: the person who raised a refund can't approve or complete it —
  // except an Admin (admin.full), who may approve their own (client testing 2026-10-09, E5).
  if (
    (parsed.data.status === "PROCESSING" || parsed.data.status === "COMPLETED") &&
    refund.raisedByUserId === session.id &&
    !session.permissions.includes(ADMIN_FULL_PERMISSION)
  ) {
    return jsonError(403, "You raised this refund, so someone else must approve it.");
  }

  // Client testing 2026-10-09 (E5) — approving an online payment's refund sends
  // it to the gateway straight away; when the gateway says it's processed the
  // refund is completed in the same step. A gateway error leaves the refund
  // untouched (staff can retry, or refund manually and mark it completed).
  let targetStatus = parsed.data.status;
  let gatewayNote = "";
  if (parsed.data.status === "PROCESSING" && refund.payment.method === "GATEWAY" && refund.payment.gatewayRef) {
    try {
      const gateway = await gatewayForPayment(refund.payment);
      const result = await gateway.refundPayment(refund.payment.gatewayRef, Math.round(Number(refund.refundAmount) * 100), {
        bookingId: refund.payment.booking.bookingId,
        refundId: refund.id,
      });
      gatewayNote = ` — gateway refund ${result.refundId} (${result.status})`;
      if (result.status === "processed") targetStatus = "COMPLETED";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gateway refund failed.";
      await writeAudit(db, {
        entityType: "Refund",
        entityId: id,
        action: "GATEWAY_REFUND_FAILED",
        byUserId: session.id,
        note: `${message} (by ${session.name})`,
      });
      return jsonError(502, `${message} The refund was not approved — try again, or refund manually and then mark it completed.`);
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.refund.update({ where: { id }, data: { status: targetStatus } });
    await writeAudit(tx, {
      entityType: "Refund",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: withReason(`${refund.status} -> ${targetStatus}${gatewayNote} (by ${session.name})`, parsed.data.reason),
    });
    // P12 — a Protection Plan refund keeps the plan's status in step.
    await syncPlanWithRefund(tx, id, targetStatus, { byUserId: session.id, label: `by ${session.name}` });

    // Once completed refunds cover everything successfully paid on the booking, the booking is REFUNDED.
    const booking = refund.payment.booking;
    if (targetStatus === "COMPLETED" && booking.status !== "REFUNDED") {
      const paidPayments = await tx.payment.findMany({ where: { bookingId: booking.id, status: "SUCCESS" } });
      const totalPaid = paidPayments.reduce((sum, payment) => sum + paymentTotal(payment), 0);
      const completed = await tx.refund.aggregate({
        where: { status: "COMPLETED", payment: { bookingId: booking.id } },
        _sum: { refundAmount: true },
      });
      const totalRefunded = Number(completed._sum.refundAmount ?? 0);
      if (totalPaid > 0 && totalRefunded + 0.001 >= totalPaid) {
        await tx.booking.update({ where: { id: booking.id }, data: { status: "REFUNDED" } });
        await writeAudit(tx, {
          entityType: "Booking",
          entityId: booking.id,
          action: "STATUS_CHANGE",
          byUserId: session.id,
          note: `${booking.status} -> REFUNDED — booking cancelled (completed refunds ₹${totalRefunded} cover the ₹${totalPaid} paid; by ${session.name})`,
        });
        // Client testing 2026-10-09 (E5) — a cancelled booking's invoices are cancelled with it.
        for (const payment of paidPayments.filter((row) => row.invoiceNumber)) {
          await writeAudit(tx, {
            entityType: "Payment",
            entityId: payment.id,
            action: "INVOICE_CANCELLED",
            byUserId: session.id,
            note: `Invoice ${payment.invoiceNumber} cancelled — booking ${booking.bookingId} fully refunded (by ${session.name})`,
          });
        }
      }
    }
    return result;
  });

  const stage = targetStatus === "PROCESSING" ? "processing" : targetStatus === "COMPLETED" ? "completed" : targetStatus === "REJECTED" ? "rejected" : null;
  if (stage) await notifyCustomerRefund(id, stage);

  return jsonSuccess(updated);
}
