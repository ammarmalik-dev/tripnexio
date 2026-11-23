import { isAutomationEnabled, localClock } from "@/lib/automation/settings";
import { reminderCooldownMs } from "@/lib/automation/payment-reminder-schedule";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { NOT_ON_HOLD_WHERE, NO_OPEN_REFUND_WHERE } from "@/lib/automation/active-booking-where";
import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { failPayment } from "@/lib/payments/complete-payment";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { leadReference } from "@/lib/leads/reference";
import { money } from "@/lib/invoices/render-invoice";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { paymentTotal } from "@/lib/payments/totals";
import { ensureLeadCustomerToken } from "@/lib/quotations/select-quotation";
import { siteConfig } from "@/lib/site-config";

export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("payment-followup", async () => {
      const pending = await db.payment.findMany({
        // Client 2026-10-27 — no payment reminders for a cancelled request (Lost / Closed lead, cancelled booking).
        where: { status: "PENDING", booking: { status: { notIn: ["CANCELLED", "REFUNDED"] }, lead: { status: { notIn: ["LOST", "CLOSED"] }, followUpOptOut: false }, AND: [NOT_ON_HOLD_WHERE, NO_OPEN_REFUND_WHERE] } },
        include: { booking: { include: { customer: true, lead: true } } },
      });

      const now = Date.now();
      let expired = 0;
      let remindersSent = 0;
      // Client doc 16 Nov (N1) — Admin's on / off for payment reminders (expiring links are still handled).
      const remindersOn = await isAutomationEnabled("PAYMENT_REMINDER");
      const clock = await localClock(new Date(now));

      for (const payment of pending) {
        const linkExpired = payment.linkExpiresAt && payment.linkExpiresAt.getTime() < now;

        if (linkExpired) {
          await db.$transaction((tx) => failPayment(tx, payment, "EXPIRED", { actorLabel: "via n8n payment-followup automation (link expired)" }));
          expired++;
          continue;
        }

        if (!remindersOn) continue;
        const cooldown = reminderCooldownMs({ serviceType: payment.booking.lead.serviceType, purpose: payment.purpose, createdAt: payment.createdAt, now, clock });
        if (cooldown === null) continue;
        if (await wasRecentlyReminded("PAYMENT_REMINDER", "Payment", payment.id, cooldown)) continue;

        // Client doc 16 Nov (N1 / N3) — always the separate Payment Reminder template (never a status message).
        const total = paymentTotal(payment);
        await notifyCustomer({
          event: NOTIFICATION_EVENTS.PAYMENT_REMINDER,
          emailTo: payment.booking.customer.email,
          whatsappTo: toWhatsAppId(payment.booking.customer.mobile),
          smsTo: toWhatsAppId(payment.booking.customer.mobile),
          variables: {
            customerName: payment.booking.customer.name,
            bookingId: payment.booking.bookingId,
            leadReference: leadReference(payment.booking.lead),
            amount: money(total),
            serviceName: SERVICE_TYPE_LABELS[payment.booking.lead.serviceType],
            paymentLink: payment.booking.customerToken ? `${siteConfig.url}/pay/${payment.booking.customerToken}` : `${siteConfig.url}/account`,
            // Client doc 16 Nov (N14) — every reminder carries the booking's Stop Reminders link.
            unsubscribeLink: `${siteConfig.url}/follow-ups/stop/${await ensureLeadCustomerToken(payment.booking.lead)}`,
          },
          auditTarget: { entityType: "Payment", entityId: payment.id },
        });
        await logReminder("PAYMENT_REMINDER", "Payment", payment.id);
        remindersSent++;
      }

      return { checked: pending.length, expired, remindersSent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/payment-followup]", error);
    return jsonError(500, "Payment follow-up job failed.");
  }
}

/** P26 — Vercel Cron calls this with GET (see vercel.json); same handler and auth as n8n's POST. */
export const GET = POST;
