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
import { createTask } from "@/lib/tasks/create-task";
import { isFlightQuote } from "@/lib/quotations/pricing";

const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// Flight_Special_Fare.md §14 "Quote Reminders": "While valid, reminders are
// sent every 10 minutes. After expiry, reminders stop." — a distinct,
// tighter cadence than every other service's single near-expiry nudge,
// matching that doc's own tighter 30-minute max validity. The n8n workflow
// itself now polls every 5 minutes (n8n/workflows/quote-expiry-handling.json)
// so this 10-minute cooldown is actually reachable in practice.
const FLIGHT_REMINDER_COOLDOWN_MS = 10 * 60 * 1000;
const TASK_DEDUPE_EVENT = "QUOTE_FOLLOW_UP_TASK";

/**
 * Called by n8n's "Quote Expiry Handling" workflow (see
 * AUTOMATION_WORKFLOWS.md). Two jobs in one pass: (1) actually flips
 * past-due quotations to expired and fires QUOTE_EXPIRED — the existing
 * syncExpiredQuotations() only ran lazily on a staff/customer read before
 * this, so a quote nobody ever looked at again would never expire or
 * notify anyone; this closes that gap. (2) sends QUOTE_REMINDER to
 * quotations still valid — every 10 minutes for Flight Special Fare
 * (Business Rules-locked cadence), or once within REMINDER_WINDOW_MS of
 * expiry for every other service (no locked cadence found for those) —
 * each deduped via AutomationReminderLog so re-running doesn't re-notify
 * faster than its own cooldown. The staff "quote about to expire" Task is
 * deliberately deduped separately (its own TASK_DEDUPE_EVENT key, same
 * near-expiry-once behavior for every service including flight quotes) so
 * a flight quote's repeated 10-minute customer reminders don't also spam
 * CRM with a new staff task every 10 minutes.
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
        const isFlight = isFlightQuote(quotation.lead.serviceType);

        const dueForReminder = isFlight
          ? !(await wasRecentlyReminded("QUOTE_REMINDER", "Quotation", quotation.id, FLIGHT_REMINDER_COOLDOWN_MS))
          : msLeft <= REMINDER_WINDOW_MS && !(await wasRecentlyReminded("QUOTE_REMINDER", "Quotation", quotation.id, REMINDER_COOLDOWN_MS));

        if (dueForReminder) {
          await notifyCustomer({
            event: NOTIFICATION_EVENTS.QUOTE_REMINDER,
            emailTo: quotation.lead.customer.email,
            whatsappTo: toWhatsAppId(quotation.lead.customer.mobile),
            smsTo: toWhatsAppId(quotation.lead.customer.mobile),
            variables: {
              customerName: quotation.lead.customer.name,
              leadReference: formatLeadReference(quotation.lead.serviceType, quotation.lead.id),
            },
            auditTarget: { entityType: "Quotation", entityId: quotation.id },
          });
          await logReminder("QUOTE_REMINDER", "Quotation", quotation.id);
          remindersSent++;
        }

        // Step 17 (audit §3.8) — "quote about to expire" is one of the
        // roadmap prompt's own named trigger points. Independent of the
        // customer-reminder cadence above — always near-expiry, always once.
        if (msLeft <= REMINDER_WINDOW_MS && !(await wasRecentlyReminded(TASK_DEDUPE_EVENT, "Quotation", quotation.id, REMINDER_COOLDOWN_MS))) {
          await createTask(db, {
            type: "QUOTE_FOLLOW_UP",
            priority: "HIGH",
            title: `Follow up — quote expiring soon (${formatLeadReference(quotation.lead.serviceType, quotation.lead.id)})`,
            reason: `Quotation validity expires within ${Math.round(REMINDER_WINDOW_MS / 60000)} minutes`,
            entityType: "Quotation",
            entityId: quotation.id,
            leadId: quotation.leadId,
            serviceType: quotation.lead.serviceType,
            dueDate: quotation.validityExpiresAt,
          });
          await logReminder(TASK_DEDUPE_EVENT, "Quotation", quotation.id);
        }
      }

      return { checked: candidates.length, expired: expiredCount, remindersSent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/quote-expiry]", error);
    return jsonError(500, "Quote expiry job failed.");
  }
}
