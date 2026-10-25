import type { NextRequest } from "next/server";
import { updateRefundStatusSchema } from "@/lib/validation/refund-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { withReason } from "@/lib/validation/sensitive-action";
import { applyRefundStatus } from "@/lib/refunds/finalize-refund";
import { dispatchStatusNotifications } from "@/lib/service-status/engine";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertValidRefundTransition } from "@/lib/refunds/transitions";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { gatewayForPayment } from "@/lib/payments/accounts";
import { notifyCustomerRefund } from "@/lib/refunds/notify-customer";
import { REFUND_APPROVAL_STATUSES, loadApproverLimit, refundApprovalLimitError } from "@/lib/refunds/approval-limit";

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

  // Admin handover §17 — a staff member's refund approval limit (admin.full is never limited).
  if (REFUND_APPROVAL_STATUSES.includes(parsed.data.status)) {
    const approver = await loadApproverLimit(db, session);
    const limitError = refundApprovalLimitError({ ...approver, amount: Number(refund.refundAmount) });
    if (limitError) return jsonError(403, limitError);
  }

  // Client testing 2026-10-09 (E5) — approving an online payment's refund sends
  // it to the gateway straight away; when the gateway says it's processed the
  // refund is completed in the same step. A gateway error leaves the refund
  // untouched (staff can retry, or refund manually and mark it completed).
  let targetStatus = parsed.data.status;
  let gatewayNote = "";
  let gatewayRefund: { gatewayRefundId: string; gatewayRefundStatus: string } | null = null;
  if (parsed.data.status === "PROCESSING" && refund.payment.method === "GATEWAY" && refund.payment.gatewayRef) {
    try {
      const gateway = await gatewayForPayment(refund.payment);
      const result = await gateway.refundPayment(refund.payment.gatewayRef, Math.round(Number(refund.refundAmount) * 100), {
        bookingId: refund.payment.booking.bookingId,
        refundId: refund.id,
      });
      gatewayNote = ` — gateway refund ${result.refundId} (${result.status})`;
      // Client doc 2026-10-15 (I5) — keep the gateway's refund id; "Check gateway" follows a pending one to its result.
      gatewayRefund = { gatewayRefundId: result.refundId, gatewayRefundStatus: result.status };
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

  const notifications = await db.$transaction((tx) =>
    applyRefundStatus(tx, id, targetStatus, { userId: session.id, label: `by ${session.name}` }, {
      note: withReason(gatewayNote, parsed.data.reason),
      ...(gatewayRefund ?? {}),
    })
  );
  await dispatchStatusNotifications(notifications);
  const updated = await db.refund.findUniqueOrThrow({ where: { id } });

  const stage = targetStatus === "PROCESSING" ? "processing" : targetStatus === "COMPLETED" ? "completed" : targetStatus === "REJECTED" ? "rejected" : null;
  if (stage) await notifyCustomerRefund(id, stage);

  return jsonSuccess(updated);
}
