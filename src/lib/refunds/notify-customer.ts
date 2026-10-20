import { db } from "../db";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import type { ServiceType } from "../../generated/prisma/enums";
import { paymentTotal } from "../payments/totals";
import { applySystemEvent, dispatchStatusNotifications } from "../service-status/engine";
import { sendStatusTemplate, statusTemplateFor, usesStatusTemplates } from "../notifications/status-template";

const STAGE_EVENT = { raised: "REFUND_RAISED", processing: "REFUND_APPROVED", completed: "REFUND_COMPLETED" } as const;

/**
 * Client doc 2026-10-20 — a refund on a service with the client's status templates: a refund of everything
 * paid moves the booking (Refund Pending → Refund Processing → Refund Completed; completion is applied in
 * applyRefundStatus); a partial one leaves the booking where it is and only sends that step's message
 * (e.g. Refund Completed with the refund ID and amount), when the service has one. A rejected refund
 * isn't on the client's lists, so nothing is sent.
 */
async function refundStatusStep(refundId: string, bookingId: string, serviceType: ServiceType, stage: RefundCustomerStage): Promise<void> {
  if (stage === "rejected") return;
  const event = STAGE_EVENT[stage];
  const paid = await db.payment.findMany({ where: { bookingId, status: "SUCCESS" } });
  const totalPaid = paid.reduce((sum, payment) => sum + paymentTotal(payment), 0);
  const refunds = await db.refund.aggregate({ where: { payment: { bookingId }, status: { not: "REJECTED" } }, _sum: { refundAmount: true } });
  const full = totalPaid > 0 && Number(refunds._sum.refundAmount ?? 0) + 0.001 >= totalPaid;
  if (full && stage !== "completed") {
    const notification = await db.$transaction((tx) => applySystemEvent(tx, { scope: "BOOKING", entityId: bookingId, event, actorLabel: `refund ${stage}` }));
    await dispatchStatusNotifications([notification]);
    return;
  }
  if (full) return; // the completion's status message was sent with applyRefundStatus
  const template = await statusTemplateFor(serviceType, "BOOKING", event);
  if (template) await sendStatusTemplate({ event: template.event, scope: "BOOKING", entityId: bookingId, statusLabel: template.label });
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
      await refundStatusStep(refund.id, booking.id, booking.lead.serviceType, stage);
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
