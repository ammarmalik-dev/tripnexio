import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { formatLeadReference } from "@/lib/leads/reference";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Called by n8n's "Quote Expiry Handling" workflow (see
 * AUTOMATION_WORKFLOWS.md). Two jobs in one pass: (1) actually flips
 * past-due quotations to expired and fires QUOTE_EXPIRED — the existing
 * syncExpiredQuotations() only ran lazily on a staff/customer read before
 * this, so a quote nobody ever looked at again would never expire or
 * notify anyone; this closes that gap. (2) sends a one-time QUOTE_REMINDER
 * to quotations about to lapse (within REMINDER_WINDOW_MS), deduped via
 * AutomationReminderLog so re-running every 15 minutes doesn't re-notify.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("quote-expiry", async () => {
      const candidates = await db.quotation.findMany({
        where: { isExpired: false, validityExpiresAt: { not: null } },
        include: { lead: { include: { customer: true } } },
      });

      const now = Date.now();
      const expiredCount = candidates.filter((q) => q.validityExpiresAt!.getTime() < now).length;
      await syncExpiredQuotations(candidates);

      const stillActive = candidates.filter((q) => q.validityExpiresAt!.getTime() >= now);
      let remindersSent = 0;
      for (const quotation of stillActive) {
        const msLeft = quotation.validityExpiresAt!.getTime() - now;
        if (msLeft > REMINDER_WINDOW_MS) continue;

        const alreadyReminded = await wasRecentlyReminded("QUOTE_REMINDER", "Quotation", quotation.id, REMINDER_COOLDOWN_MS);
        if (alreadyReminded) continue;

        await notifyCustomer({
          event: NOTIFICATION_EVENTS.QUOTE_REMINDER,
          emailTo: quotation.lead.customer.email,
          whatsappTo: toWhatsAppId(quotation.lead.customer.mobile),
          variables: {
            customerName: quotation.lead.customer.name,
            leadReference: formatLeadReference(quotation.lead.serviceType, quotation.lead.id),
          },
          auditTarget: { entityType: "Quotation", entityId: quotation.id },
        });
        await logReminder("QUOTE_REMINDER", "Quotation", quotation.id);
        remindersSent++;
      }

      return { checked: candidates.length, expired: expiredCount, remindersSent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/quote-expiry]", error);
    return jsonError(500, "Quote expiry job failed.");
  }
}
