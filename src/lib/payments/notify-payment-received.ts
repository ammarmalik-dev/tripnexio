import { db } from "../db";
import { formatLeadReference } from "../leads/reference";
import { buildInvoicePdfForPayment, money } from "../invoices/render-invoice";
import { sendNotificationEmail } from "../notifications/send-notification-email";
import { NOTIFICATION_EVENTS } from "../notifications/events";

/**
 * Called by the mark-success route and the gateway webhook route right
 * after their db.$transaction commits — never from inside completePaymentSuccess
 * itself, since sending an email (and rendering a PDF) is external I/O that
 * has no business holding a DB transaction open. Attaches the same tax
 * invoice PDF the staff-facing download route generates.
 */
export async function notifyPaymentReceived(paymentId: string): Promise<void> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { customer: true, lead: true } } },
  });
  if (!payment) return;

  const invoice = await buildInvoicePdfForPayment(paymentId);
  const total = invoice?.total ?? Number(payment.amount) + Number(payment.gstAmount) + Number(payment.gatewayFee);

  await sendNotificationEmail({
    event: NOTIFICATION_EVENTS.PAYMENT_RECEIVED,
    to: payment.booking.customer.email,
    variables: {
      customerName: payment.booking.customer.name,
      bookingId: payment.booking.bookingId,
      leadReference: formatLeadReference(payment.booking.lead.serviceType, payment.booking.leadId),
      amount: money(total),
    },
    auditTarget: { entityType: "Payment", entityId: payment.id },
    attachments: invoice ? [{ filename: `invoice-${payment.booking.bookingId}.pdf`, content: invoice.pdf }] : undefined,
  });
}
