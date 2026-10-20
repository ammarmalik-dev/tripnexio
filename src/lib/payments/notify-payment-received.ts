import { db } from "../db";
import { tripSummaryForLead } from "../leads/trip-summary";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { leadReference } from "../leads/reference";
import { buildInvoicePdfForPayment, money } from "../invoices/render-invoice";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { paymentTotal } from "./totals";
import { dispatchStatusNotifications, type StatusNotification } from "../service-status/engine";
import { notifyStaffPaymentReceived } from "../staff-notifications/triggers";
import { usesStatusTemplates } from "../notifications/status-template";
import { ensureRequiredDocumentSlots } from "../documents/required-slots";

/**
 * Called by the mark-success route and the gateway webhook route right
 * after their db.$transaction commits — never from inside completePaymentSuccess
 * itself, since sending an email (and rendering a PDF) is external I/O that
 * has no business holding a DB transaction open. The invoice PDF is
 * attached on the email side only — a WhatsApp Message Template's document
 * header needs the PDF hosted at a public URL or pre-uploaded via Meta's
 * Media API, neither of which this app has yet (no file storage/CDN — see
 * Document.fileUrl's own "no storage integration here" note); the WhatsApp
 * copy instead points the customer at their email/the CRM for the invoice.
 */
export async function notifyPaymentReceived(paymentId: string, statusNotifications: StatusNotification[] = []): Promise<void> {
  // P22 — staff notifications feed. Every success path (webhook, mark-success,
  // bank-transfer approval, demo pay) calls this only after its transaction
  // commits and only on a real transition, so staff are notified exactly once.
  await notifyStaffPaymentReceived(paymentId);
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { customer: true, lead: true } } },
  });
  if (!payment) {
    await dispatchStatusNotifications(statusNotifications);
    return;
  }

  // Client doc 2026-10-20 (B4) — the booking's document checklist slots, per passenger.
  await ensureRequiredDocumentSlots(payment.bookingId).catch(() => 0);
  const invoice = await buildInvoicePdfForPayment(paymentId);
  const total = invoice?.total ?? paymentTotal(payment);
  const invoiceAttachment = invoice ? [{ filename: `invoice-${payment.booking.bookingId}.pdf`, content: invoice.pdf }] : undefined;

  // P08 / client doc 2026-10-20 — the status the payment moved the booking onto ("Paid") sends the client's
  // "Payment Received" template with the invoice attached; then no separate payment message is sent.
  const sent = await dispatchStatusNotifications(statusNotifications, { attachments: invoiceAttachment });
  if (sent > 0 && (await usesStatusTemplates(payment.booking.lead.serviceType))) return;

  await notifyCustomer({
    event: NOTIFICATION_EVENTS.PAYMENT_RECEIVED,
    emailTo: payment.booking.customer.email,
    whatsappTo: toWhatsAppId(payment.booking.customer.mobile),
    smsTo: toWhatsAppId(payment.booking.customer.mobile),
    variables: {
      customerName: payment.booking.customer.name,
      bookingId: payment.booking.bookingId,
      leadReference: leadReference(payment.booking.lead),
      amount: money(total),
      tripSummary: await tripSummaryForLead(payment.booking.leadId, SERVICE_TYPE_LABELS[payment.booking.lead.serviceType]),
    },
    auditTarget: { entityType: "Payment", entityId: payment.id },
    emailAttachments: invoiceAttachment,
  });
}
