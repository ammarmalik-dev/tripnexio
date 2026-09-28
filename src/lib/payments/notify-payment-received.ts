import { db } from "../db";
import { leadReference } from "../leads/reference";
import { buildInvoicePdfForPayment, money } from "../invoices/render-invoice";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { paymentTotal } from "./totals";
import { dispatchStatusNotifications, type StatusNotification } from "../service-status/engine";

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
  // P08 — any per-service status messages Admin configured for the statuses the payment moved the booking/lead onto.
  await dispatchStatusNotifications(statusNotifications);
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { customer: true, lead: true } } },
  });
  if (!payment) return;

  const invoice = await buildInvoicePdfForPayment(paymentId);
  const total = invoice?.total ?? paymentTotal(payment);

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
    },
    auditTarget: { entityType: "Payment", entityId: payment.id },
    emailAttachments: invoice ? [{ filename: `invoice-${payment.booking.bookingId}.pdf`, content: invoice.pdf }] : undefined,
  });
}
