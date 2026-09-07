import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { failPayment } from "@/lib/payments/complete-payment";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { formatLeadReference } from "@/lib/leads/reference";
import { money } from "@/lib/invoices/render-invoice";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

const REMIND_AFTER_MS = 2 * 60 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Called by n8n's "Payment Follow-up Reminders" workflow. Two jobs: (1)
 * a PENDING payment whose gateway link has actually expired
 * (linkExpiresAt in the past) gets marked EXPIRED — a PaymentStatus value
 * that existed in the schema since Phase 5A but nothing ever set it until
 * now, since only a customer paying or a webhook failure moved a payment
 * out of PENDING before this. (2) a still-payable PENDING payment that's
 * sat unpaid for a while gets a one-time PAYMENT_REMINDER nudge.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("payment-followup", async () => {
      const pending = await db.payment.findMany({
        where: { status: "PENDING" },
        include: { booking: { include: { customer: true, lead: true } } },
      });

      const now = Date.now();
      let expired = 0;
      let remindersSent = 0;

      for (const payment of pending) {
        const linkExpired = payment.linkExpiresAt && payment.linkExpiresAt.getTime() < now;

        if (linkExpired) {
          await db.$transaction((tx) => failPayment(tx, payment, "EXPIRED", { actorLabel: "via n8n payment-followup automation (link expired)" }));
          expired++;
          continue;
        }

        const createdLongEnoughAgo = now - payment.createdAt.getTime() >= REMIND_AFTER_MS;
        if (!createdLongEnoughAgo) continue;

        const alreadyReminded = await wasRecentlyReminded("PAYMENT_REMINDER", "Payment", payment.id, REMINDER_COOLDOWN_MS);
        if (alreadyReminded) continue;

        const total = Number(payment.amount) + Number(payment.gstAmount) + Number(payment.gatewayFee);
        await notifyCustomer({
          event: NOTIFICATION_EVENTS.PAYMENT_REMINDER,
          emailTo: payment.booking.customer.email,
          whatsappTo: toWhatsAppId(payment.booking.customer.mobile),
          variables: {
            customerName: payment.booking.customer.name,
            bookingId: payment.booking.bookingId,
            leadReference: formatLeadReference(payment.booking.lead.serviceType, payment.booking.leadId),
            amount: money(total),
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
