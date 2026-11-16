import { db } from "../db";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { paymentTotal } from "../payments/totals";
import { applySystemEvent, dispatchStatusNotifications } from "../service-status/engine";
import { usesStatusTemplates } from "../notifications/status-template";

/**
 * Client doc 16 Nov (§1 rules 12–14, §8) — a refund on a service with the client's status templates moves the booking
 * along the shared cancellation tail: raised → "Cancellation Requested" (OTB: "Partially Cancellation Requested" when
 * it covers some passengers only), each with its message; approval / gateway processing has no status of its own; the
 * completed refund sets "Partially Cancelled" or "Cancelled" (with that message) in applyRefundStatus. A rejected
 * refund isn't on the client's lists, so nothing is sent here.
 */
async function refundStatusStep(bookingId: string, stage: RefundCustomerStage): Promise<void> {
  if (stage !== "raised") return;
  const paid = await db.payment.findMany({ where: { bookingId, status: "SUCCESS" } });
  const totalPaid = paid.reduce((sum, payment) => sum + paymentTotal(payment), 0);
  const refunds = await db.refund.aggregate({ where: { payment: { bookingId }, status: { not: "REJECTED" } }, _sum: { refundAmount: true } });
  const full = totalPaid > 0 && Number(refunds._sum.refundAmount ?? 0) + 0.001 >= totalPaid;
  const notification = await db.$transaction((tx) =>
    applySystemEvent(tx, { scope: "BOOKING", entityId: bookingId, event: full ? "REFUND_RAISED" : "PARTIAL_REFUND_RAISED", actorLabel: "refund raised" })
  );
  await dispatchStatusNotifications([notification]);
}

const STATUS_WORDING = {
  raised: "has been raised and is being reviewed",
  processing: "has been approved and sent to the payment gateway — it usually reaches your account in 5-7 working days",
  completed: "has been completed",
  rejected: "could not be approved",
} as const;

export type RefundCustomerStage = keyof typeof STATUS_WORDING;

/**
 * Client testing 2026-10-09 (E4/E5) — the customer hears about their refund:
 * when it's raised, approved/sent to the gateway, completed or rejected
 * (email + WhatsApp, Admin-editable REFUND_UPDATE templates). Never throws.
 */
export async function notifyCustomerRefund(refundId: string, stage: RefundCustomerStage): Promise<void> {
  try {
    const refund = await db.refund.findUnique({
      where: { id: refundId },
      include: { payment: { include: { booking: { include: { customer: true, lead: { select: { serviceType: true } } } } } } },
    });
    if (!refund) return;
    const { booking } = refund.payment;
    if (await usesStatusTemplates(booking.lead.serviceType)) {
      await refundStatusStep(booking.id, stage);
      return;
    }
    await notifyCustomer({
      event: NOTIFICATION_EVENTS.REFUND_UPDATE,
      emailTo: booking.customer.email,
      whatsappTo: toWhatsAppId(booking.customer.mobile),
      smsTo: toWhatsAppId(booking.customer.mobile),
      variables: {
        customerName: booking.customer.name,
        bookingId: booking.bookingId,
        serviceType: SERVICE_TYPE_LABELS[booking.lead.serviceType],
        refundAmount: `Rs. ${Number(refund.refundAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        refundStatus: STATUS_WORDING[stage],
      },
      auditTarget: { entityType: "Refund", entityId: refund.id },
    });
  } catch (error) {
    console.error("[refund-notify] failed", error instanceof Error ? error.name : "unknown");
  }
}
