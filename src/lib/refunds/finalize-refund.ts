import type { Prisma } from "../../generated/prisma/client";
import type { RefundStatus } from "../../generated/prisma/enums";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { paymentTotal } from "../payments/totals";
import { syncPlanWithRefund } from "../protection-plan/lifecycle";
import { applySystemEvent, dispatchStatusNotifications, type StatusNotification } from "../service-status/engine";
import { gatewayForPayment } from "../payments/accounts";
import { notifyCustomerRefund } from "./notify-customer";

type Tx = Prisma.TransactionClient;

export interface RefundActor {
  userId?: string;
  /** e.g. "by Asha" or "gateway check" — goes in the audit note. */
  label: string;
}

/**
 * Moves a refund to `targetStatus` and keeps everything that depends on it in
 * step: the audit row, a Protection Plan refund, the gateway refund id, and —
 * once it is COMPLETED — the booking (client doc 2026-10-15, I5):
 *   - completed refunds cover everything paid → booking REFUNDED, its invoices
 *     cancelled, and the service status tagged REFUND_COMPLETED (e.g. "Cancelled");
 *   - otherwise → the service status tagged REFUND_PARTIALLY_COMPLETED (e.g. "Partially Cancelled").
 * Returns the status notifications to send after the transaction commits.
 */
export async function applyRefundStatus(
  tx: Tx,
  refundId: string,
  targetStatus: RefundStatus,
  actor: RefundActor,
  extra: { note?: string; gatewayRefundId?: string; gatewayRefundStatus?: string } = {}
): Promise<StatusNotification[]> {
  const refund = await tx.refund.findUniqueOrThrow({
    where: { id: refundId },
    include: { payment: { include: { booking: true } } },
  });
  await tx.refund.update({
    where: { id: refundId },
    data: {
      status: targetStatus,
      ...(extra.gatewayRefundId ? { gatewayRefundId: extra.gatewayRefundId } : {}),
      ...(extra.gatewayRefundStatus ? { gatewayRefundStatus: extra.gatewayRefundStatus } : {}),
      ...(targetStatus === "COMPLETED" && !refund.completedAt ? { completedAt: new Date() } : {}),
    },
  });
  await writeAudit(tx, {
    entityType: "Refund",
    entityId: refundId,
    action: "STATUS_CHANGE",
    byUserId: actor.userId,
    note: `${refund.status} -> ${targetStatus}${extra.note ?? ""} (${actor.label})`,
  });
  // P12 — a Protection Plan refund keeps the plan's status in step.
  await syncPlanWithRefund(tx, refundId, targetStatus, { byUserId: actor.userId, label: actor.label });

  const notifications: StatusNotification[] = [];
  const booking = refund.payment.booking;
  if (targetStatus !== "COMPLETED" || refund.status === "COMPLETED") return notifications;

  const paidPayments = await tx.payment.findMany({ where: { bookingId: booking.id, status: "SUCCESS" } });
  const totalPaid = paidPayments.reduce((sum, payment) => sum + paymentTotal(payment), 0);
  const completed = await tx.refund.aggregate({
    where: { status: "COMPLETED", payment: { bookingId: booking.id } },
    _sum: { refundAmount: true },
  });
  const totalRefunded = Number(completed._sum.refundAmount ?? 0);
  const fullyRefunded = totalPaid > 0 && totalRefunded + 0.001 >= totalPaid;

  // The per-service status first (it may set the coarse status too), then the coarse REFUNDED.
  const statusNotification = await applySystemEvent(tx, {
    scope: "BOOKING",
    entityId: booking.id,
    event: fullyRefunded ? "REFUND_COMPLETED" : "REFUND_PARTIALLY_COMPLETED",
    userId: actor.userId,
    actorLabel: actor.label,
  });
  if (statusNotification) notifications.push(statusNotification);
  if (fullyRefunded) {
    // Client doc 2026-10-20 — then the final "Cancelled and Refunded" state, with no second message.
    await applySystemEvent(tx, { scope: "BOOKING", entityId: booking.id, event: "CANCELLED_AND_REFUNDED", userId: actor.userId, actorLabel: actor.label, silent: true });
  } else {
    // Client doc 2026-10-20 (N2) — a partial refund shows its passengers as cancelled (no undecided passenger
    // is left looking active). Client 2026-10-27 (C4, RT104) — the booking then stays on "Partially Cancelled"
    // (not silently back on "Paid"); its other passengers carry on from it with the forward moves of the status
    // it had before (engine operationalFrom), and no refund / partial status can be picked by hand.
    if (refund.passengerIds.length > 0) {
      const cancelledRows = await tx.bookingPassenger.updateMany({
        where: { bookingId: booking.id, passengerId: { in: refund.passengerIds }, outcome: null },
        data: { outcome: "CANCELLED" },
      });
      if (cancelledRows.count > 0) {
        await writeAudit(tx, {
          entityType: "Booking",
          entityId: booking.id,
          action: "PASSENGER_OUTCOME",
          byUserId: actor.userId,
          note: `${cancelledRows.count} passenger(s) marked Cancelled by the completed partial refund (${actor.label})`,
        });
      }
    }
  }

  if (fullyRefunded && booking.status !== "REFUNDED") {
    await tx.booking.update({ where: { id: booking.id }, data: { status: "REFUNDED" } });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: booking.id,
      action: "STATUS_CHANGE",
      byUserId: actor.userId,
      note: `${booking.status} -> REFUNDED — booking cancelled (completed refunds ₹${totalRefunded} cover the ₹${totalPaid} paid; ${actor.label})`,
    });
    // Client testing 2026-10-09 (E5) — a cancelled booking's invoices are cancelled with it.
    for (const payment of paidPayments.filter((row) => row.invoiceNumber)) {
      await writeAudit(tx, {
        entityType: "Payment",
        entityId: payment.id,
        action: "INVOICE_CANCELLED",
        byUserId: actor.userId,
        note: `Invoice ${payment.invoiceNumber} cancelled — booking ${booking.bookingId} fully refunded (${actor.label})`,
      });
    }
  }
  return notifications;
}

export type GatewayRefundSyncResult =
  | { ok: true; changed: boolean; status: RefundStatus; gatewayRefundStatus: string }
  | { ok: false; error: string };

/**
 * Client doc 2026-10-15 (I5) — asks the gateway for a PROCESSING refund's real
 * result and follows it: "processed" completes the refund, "failed" sends it
 * back to PENDING for another approval. Used by the "Check gateway" action and
 * when the refunds list loads. Never throws.
 */
export async function syncRefundWithGateway(refundId: string, actor: RefundActor): Promise<GatewayRefundSyncResult> {
  try {
    const refund = await db.refund.findUnique({ where: { id: refundId }, include: { payment: true } });
    if (!refund) return { ok: false, error: "Refund not found." };
    if (refund.status !== "PROCESSING" || !refund.gatewayRefundId) {
      return { ok: false, error: "Only a refund sent to the gateway and still processing can be checked." };
    }
    const gateway = await gatewayForPayment(refund.payment);
    const result = await gateway.fetchRefundStatus(refund.gatewayRefundId);
    const target: RefundStatus | null = result.status === "processed" ? "COMPLETED" : result.status === "failed" ? "PENDING" : null;
    if (!target) {
      if (result.status !== refund.gatewayRefundStatus) {
        await db.refund.update({ where: { id: refundId }, data: { gatewayRefundStatus: result.status } });
      }
      return { ok: true, changed: false, status: refund.status, gatewayRefundStatus: result.status };
    }
    const notifications = await db.$transaction((tx) =>
      applyRefundStatus(tx, refundId, target, actor, {
        note: ` — gateway refund ${result.refundId} ${result.status}`,
        gatewayRefundStatus: result.status,
      })
    );
    await dispatchStatusNotifications(notifications);
    if (target === "COMPLETED") await notifyCustomerRefund(refundId, "completed");
    return { ok: true, changed: true, status: target, gatewayRefundStatus: result.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't reach the gateway." };
  }
}
