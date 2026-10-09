import { db } from "../db";
import { leadReference } from "../leads/reference";
import { money } from "../invoices/render-invoice";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { SERVICE_TYPE_LABELS } from "../crm/labels";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "../site-config";
import { paymentTotal } from "./totals";

/**
 * Client testing 2026-10-09 (A3, E4) — every new payment link reaches the
 * customer on email + WhatsApp with the Booking ID and the link to their
 * /pay page: the website checkout (New Visa / OTB / Return Ticket), a CRM
 * "Create Payment Link", and extra payments. Called after the payment row
 * is committed; never throws (notifyCustomer audits every outcome).
 */
export async function notifyPaymentLinkReady(paymentId: string): Promise<void> {
  try {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { customer: true, lead: true } } },
    });
    if (!payment || !payment.booking.customerToken) return;
    const booking = payment.booking;
    await notifyCustomer({
      event: NOTIFICATION_EVENTS.PAYMENT_LINK_READY,
      emailTo: booking.customer.email,
      whatsappTo: toWhatsAppId(booking.customer.mobile),
      smsTo: toWhatsAppId(booking.customer.mobile),
      variables: {
        customerName: booking.customer.name,
        serviceType: SERVICE_TYPE_LABELS[booking.lead.serviceType],
        bookingId: booking.bookingId,
        leadReference: leadReference(booking.lead),
        amount: money(paymentTotal(payment)),
        paymentLink: `${siteConfig.url}/pay/${booking.customerToken}`,
        linkExpiresAt: payment.linkExpiresAt
          ? payment.linkExpiresAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
          : "",
        paymentPurpose: payment.purpose === "EXTRA" ? (payment.description ?? "Additional payment") : "Booking payment",
      },
      auditTarget: { entityType: "Payment", entityId: payment.id },
    });
  } catch (error) {
    console.error("[notify-payment-link] failed", error instanceof Error ? error.name : "unknown");
  }
}
