import { db } from "../db";
import { tripSummaryForLead } from "../leads/trip-summary";
import { leadReference } from "../leads/reference";
import { money } from "../invoices/render-invoice";
import { notifyCustomer } from "../notifications/notify";
import { sendCurrentStatusTemplate, usesStatusTemplates } from "../notifications/status-template";
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
export async function notifyPaymentLinkReady(paymentId: string, options: { skipWhatsApp?: boolean } = {}): Promise<void> {
  try {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { customer: true, lead: true } } },
    });
    if (!payment || !payment.booking.customerToken) return;
    const booking = payment.booking;
    // Client doc 2026-10-20 — a booking payment on the client's status templates goes out as the lead's own
    // status message ("request received — Complete Payment"), not a separate payment-link message. A
    // Special Fare difference payment is announced by its "Additional Payment Required" status.
    if (await usesStatusTemplates(booking.lead.serviceType)) {
      if (payment.purpose !== "EXTRA") {
        // Only a new request's first link (New Visa / OTB / Return Ticket) — a quotation's link was in "Quotation Approved".
        const leadStatus = await db.serviceStatus.findFirst({ where: { leads: { some: { id: booking.leadId } } }, select: { displayOrder: true, systemEvent: true } });
        if (leadStatus && leadStatus.displayOrder === 0) await sendCurrentStatusTemplate("LEAD", booking.leadId, { skipWhatsApp: options.skipWhatsApp });
        return;
      }
      const current = await db.serviceStatus.findFirst({ where: { bookings: { some: { id: booking.id } } }, select: { systemEvent: true } });
      if (current?.systemEvent === "FSF_ADDITIONAL_PAYMENT_PENDING") return;
    }
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
        tripSummary: await tripSummaryForLead(booking.leadId, SERVICE_TYPE_LABELS[booking.lead.serviceType]),
      },
      auditTarget: { entityType: "Payment", entityId: payment.id },
      skipWhatsApp: options.skipWhatsApp,
    });
  } catch (error) {
    console.error("[notify-payment-link] failed", error instanceof Error ? error.name : "unknown");
  }
}
