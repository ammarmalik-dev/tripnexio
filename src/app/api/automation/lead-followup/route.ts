import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { formatLeadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Called by n8n's "Periodic Service Follow-ups" workflow — a lead sitting
 * in a non-terminal status (never quoted, quoted but not converted, etc.)
 * with no activity in a while gets a periodic LEAD_FOLLOWUP nudge, at most
 * once per REMINDER_COOLDOWN_MS (so it recurs periodically rather than
 * firing once and never again, unlike the one-shot QUOTE_REMINDER/
 * PAYMENT_REMINDER jobs — a genuinely "periodic" follow-up per the task).
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("lead-followup", async () => {
      const cutoff = new Date(Date.now() - STALE_AFTER_MS);
      const staleLeads = await db.lead.findMany({
        where: {
          status: {
            in: [
              "NEW",
              "CONTACTED",
              "FOLLOW_UP_REQUIRED",
              "CUSTOMER_RESPONDED",
              "QUALIFIED",
              "QUOTATION_CREATED",
              "QUOTATION_ACCEPTED",
              "PAYMENT_PENDING",
            ],
          },
          updatedAt: { lt: cutoff },
        },
        include: { customer: true },
      });

      let remindersSent = 0;
      for (const lead of staleLeads) {
        const alreadyReminded = await wasRecentlyReminded("LEAD_FOLLOWUP", "Lead", lead.id, REMINDER_COOLDOWN_MS);
        if (alreadyReminded) continue;

        await notifyCustomer({
          event: NOTIFICATION_EVENTS.LEAD_FOLLOWUP,
          emailTo: lead.customer.email,
          whatsappTo: toWhatsAppId(lead.customer.mobile),
          variables: {
            customerName: lead.customer.name,
            serviceType: SERVICE_TYPE_LABELS[lead.serviceType],
            leadReference: formatLeadReference(lead.serviceType, lead.id),
          },
          auditTarget: { entityType: "Lead", entityId: lead.id },
        });
        await logReminder("LEAD_FOLLOWUP", "Lead", lead.id);
        remindersSent++;
      }

      return { checked: staleLeads.length, remindersSent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/lead-followup]", error);
    return jsonError(500, "Lead follow-up job failed.");
  }
}
