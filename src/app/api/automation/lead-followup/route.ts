import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { leadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { getServiceTimelineRules } from "@/lib/settings/service-timeline-config";
import { ensureLeadCustomerToken } from "@/lib/quotations/select-quotation";
import { siteConfig } from "@/lib/site-config";
import type { Customer, Lead } from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 3 * DAY_MS;
const REMINDER_COOLDOWN_MS = 3 * DAY_MS;
/** Flight_Special_Fare.md §21 — every 7 days until booked, unless Admin sets ServiceTimelineConfig.followUpIntervalDays. */
const DEFAULT_FLIGHT_FARE_FOLLOW_UP_DAYS = 7;

const OPEN_STATUSES = [
  "NEW",
  "CONTACTED",
  "FOLLOW_UP_REQUIRED",
  "CUSTOMER_RESPONDED",
  "QUALIFIED",
  "QUOTATION_CREATED",
  "QUOTATION_ACCEPTED",
  "PAYMENT_PENDING",
] as const;

async function sendFollowUp(lead: Lead & { customer: Customer }) {
  const token = await ensureLeadCustomerToken(lead);
  await notifyCustomer({
    event: NOTIFICATION_EVENTS.LEAD_FOLLOWUP,
    emailTo: lead.customer.email,
    whatsappTo: toWhatsAppId(lead.customer.mobile),
    smsTo: toWhatsAppId(lead.customer.mobile),
    variables: {
      customerName: lead.customer.name,
      serviceType: SERVICE_TYPE_LABELS[lead.serviceType],
      leadReference: leadReference(lead),
      unsubscribeLink: `${siteConfig.url}/follow-ups/stop/${token}`,
    },
    auditTarget: { entityType: "Lead", entityId: lead.id },
  });
  await logReminder("LEAD_FOLLOWUP", "Lead", lead.id);
}

/**
 * Called by n8n's "Periodic Service Follow-ups" workflow. Two cadences:
 * - Flight Special Fare leads with no booking get a reminder every
 *   `followUpIntervalDays` (default 7) until booked, LOST/CLOSED, or the
 *   customer opts out via the unsubscribe link.
 * - Every other service keeps the stalled-lead nudge: open status, no
 *   activity in 3 days, at most once per 3 days.
 * No customer who opted out (Lead.followUpOptOut) is ever reminded.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("lead-followup", async () => {
      const now = Date.now();

      const staleLeads = await db.lead.findMany({
        where: {
          serviceType: { not: "FLIGHT_SPECIAL_FARE" },
          status: { in: [...OPEN_STATUSES] },
          followUpOptOut: false,
          updatedAt: { lt: new Date(now - STALE_AFTER_MS) },
        },
        include: { customer: true },
      });

      const flightIntervalDays = (await getServiceTimelineRules("FLIGHT_SPECIAL_FARE")).followUpIntervalDays ?? DEFAULT_FLIGHT_FARE_FOLLOW_UP_DAYS;
      const flightIntervalMs = flightIntervalDays * DAY_MS;
      const flightLeads = await db.lead.findMany({
        where: {
          serviceType: "FLIGHT_SPECIAL_FARE",
          status: { notIn: ["LOST", "CLOSED", "CONVERTED"] },
          followUpOptOut: false,
          bookings: { none: {} },
          createdAt: { lt: new Date(now - flightIntervalMs) },
        },
        include: { customer: true },
      });

      let remindersSent = 0;
      for (const lead of staleLeads) {
        if (await wasRecentlyReminded("LEAD_FOLLOWUP", "Lead", lead.id, REMINDER_COOLDOWN_MS)) continue;
        await sendFollowUp(lead);
        remindersSent++;
      }
      let flightRemindersSent = 0;
      for (const lead of flightLeads) {
        if (await wasRecentlyReminded("LEAD_FOLLOWUP", "Lead", lead.id, flightIntervalMs)) continue;
        await sendFollowUp(lead);
        flightRemindersSent++;
      }

      return {
        checked: staleLeads.length + flightLeads.length,
        remindersSent: remindersSent + flightRemindersSent,
        flightFareRemindersSent: flightRemindersSent,
        flightFareIntervalDays: flightIntervalDays,
      };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/lead-followup]", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Lead follow-up job failed.");
  }
}
