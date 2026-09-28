import type { NextRequest } from "next/server";
import { updateRefundStatusSchema } from "@/lib/validation/refund-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertValidRefundTransition } from "@/lib/refunds/transitions";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { paymentTotal } from "@/lib/payments/totals";

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

  // Maker-checker: the person who raised a refund can't approve or complete it.
  if ((parsed.data.status === "PROCESSING" || parsed.data.status === "COMPLETED") && refund.raisedByUserId === session.id) {
    return jsonError(403, "You raised this refund, so someone else must approve it.");
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.refund.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAudit(tx, {
      entityType: "Refund",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `${refund.status} -> ${parsed.data.status}${parsed.data.note ? `: ${parsed.data.note}` : ""} (by ${session.name})`,
    });

    // Once completed refunds cover everything successfully paid on the booking, the booking is REFUNDED.
    const booking = refund.payment.booking;
    if (parsed.data.status === "COMPLETED" && booking.status !== "REFUNDED") {
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
          note: `${booking.status} -> REFUNDED (completed refunds ₹${totalRefunded} cover the ₹${totalPaid} paid; by ${session.name})`,
        });
      }
    }
    return result;
  });

  return jsonSuccess(updated);
}
