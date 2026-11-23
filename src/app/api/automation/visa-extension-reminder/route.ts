import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { isAutomationEnabled, localClock, localDateOf } from "@/lib/automation/settings";
import { addDays, afterExtensionReminderDue, uaeVisaReminderDue } from "@/lib/automation/campaign-schedule";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";
import { ensureLeadCustomerToken } from "@/lib/quotations/select-quotation";

const ONCE_MS = 3650 * 24 * 60 * 60 * 1000;
const SEND_HOUR = 12;
const UAE = new Set(["AE", "ARE", "UAE"]);

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Client doc 16 Nov (N6) — UAE visa extension reminders, 12:00 PM local time, Email + WhatsApp (Admin → Automation):
 * - a UAE New Visa (delivered): a 30-day visa on day 20 / 25 / 30 from the travel date, a 60-day visa on day
 *   50 / 55 / 60 — until the customer starts a Visa Extension;
 * - after an extension application (Applied to Embassy): day 25 and 29 from the application date.
 * Each reminder once per booking; never after the customer's Stop Reminders. Runs hourly, sends only at 12:00.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("visa-extension-reminder", async () => {
      const clock = await localClock();
      if (clock.hour !== SEND_HOUR || !(await isAutomationEnabled("VISA_EXTENSION_EXPIRY_REMINDER"))) {
        return { skipped: "outside 12:00 or switched off", localHour: clock.hour };
      }
      let remindersSent = 0;

      const send = async (
        booking: { id: string; bookingId: string; customer: { name: string; email: string | null; mobile: string }; lead: { id: string; customerToken: string | null } },
        day: number,
        expiryIso: string | null
      ) => {
        const key = `VISA_EXTENSION_REMINDER:${day}`;
        if (await wasRecentlyReminded(key, "Booking", booking.id, ONCE_MS)) return;
        const token = await ensureLeadCustomerToken(booking.lead);
        await notifyCustomer({
          event: NOTIFICATION_EVENTS.VISA_EXTENSION_REMINDER,
          emailTo: booking.customer.email,
          whatsappTo: toWhatsAppId(booking.customer.mobile),
          variables: {
            customerName: booking.customer.name,
            bookingId: booking.bookingId,
            extensionExpiryDate: expiryIso ? shortDate(expiryIso) : "",
            dayNumber: String(day),
            applyLink: `${siteConfig.url}/services/visa-extension/request`,
            unsubscribeLink: `${siteConfig.url}/follow-ups/stop/${token}`,
          },
          auditTarget: { entityType: "Booking", entityId: booking.id },
        });
        await logReminder(key, "Booking", booking.id);
        remindersSent++;
      };

      // UAE New Visa customers.
      const visas = await db.booking.findMany({
        where: {
          status: { in: ["CONFIRMED", "PROCESSING", "COMPLETED"] },
          lead: { serviceType: "NEW_VISA", followUpOptOut: false, travelDate: { not: null } },
          documents: { some: { type: "VISA_PDF", deliveredAt: { not: null } } },
        },
        select: {
          id: true,
          bookingId: true,
          customerId: true,
          createdAt: true,
          customer: { select: { name: true, email: true, mobile: true } },
          lead: { select: { id: true, customerToken: true, travelDate: true, details: true, country: { select: { code: true, name: true } } } },
        },
        take: 2000,
      });
      const configIds = [...new Set(visas.map((booking) => (booking.lead.details as Record<string, unknown> | null)?.newVisaConfigId).filter((id): id is string => typeof id === "string"))];
      const stays = new Map((await db.newVisaCountryConfig.findMany({ where: { id: { in: configIds } }, select: { id: true, stayDays: true } })).map((row) => [row.id, row.stayDays]));
      for (const booking of visas) {
        const uae = UAE.has((booking.lead.country?.code ?? "").toUpperCase()) || /emirates/i.test(booking.lead.country?.name ?? "");
        if (!uae || !booking.lead.travelDate) continue;
        const configId = (booking.lead.details as Record<string, unknown> | null)?.newVisaConfigId;
        const stayDays = typeof configId === "string" ? (stays.get(configId) ?? null) : null;
        const travel = booking.lead.travelDate.toISOString().slice(0, 10);
        const day = uaeVisaReminderDue(clock.date, travel, stayDays);
        if (!day) continue;
        const startedExtension = await db.lead.count({ where: { customerId: booking.customerId, serviceType: "VISA_EXTENSION", createdAt: { gt: booking.createdAt } } });
        if (startedExtension > 0) continue;
        await send(booking, day, stayDays ? addDays(travel, stayDays) : null);
      }

      // After an extension application.
      const extensions = await db.booking.findMany({
        where: {
          status: { in: ["CONFIRMED", "PROCESSING", "COMPLETED"] },
          appliedToEmbassyAt: { not: null },
          lead: { serviceType: "VISA_EXTENSION", followUpOptOut: false },
          OR: [{ extensionOutcome: null }, { extensionOutcome: "EXTENDED" }],
        },
        select: {
          id: true,
          bookingId: true,
          customerId: true,
          appliedToEmbassyAt: true,
          customer: { select: { name: true, email: true, mobile: true } },
          lead: { select: { id: true, customerToken: true } },
        },
        take: 2000,
      });
      for (const booking of extensions) {
        const applied = localDateOf(booking.appliedToEmbassyAt!, clock.offsetMs);
        const day = afterExtensionReminderDue(clock.date, applied);
        if (!day) continue;
        const newer = await db.lead.count({ where: { customerId: booking.customerId, serviceType: "VISA_EXTENSION", createdAt: { gt: booking.appliedToEmbassyAt! } } });
        if (newer > 0) continue;
        await send(booking, day, addDays(applied, 30));
      }

      return { localDate: clock.date, newVisaChecked: visas.length, extensionsChecked: extensions.length, remindersSent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/visa-extension-reminder]", error instanceof Error ? error.message : "error");
    return jsonError(500, "Visa Extension reminder job failed.");
  }
}

/** Same handler for GET (Vercel Cron) and POST (n8n / VPS scheduler). */
export const GET = POST;
