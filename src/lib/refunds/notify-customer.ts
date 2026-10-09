import { db } from "../db";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

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
