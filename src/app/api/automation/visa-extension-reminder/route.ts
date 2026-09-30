import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";

const DAY_MS = 24 * 60 * 60 * 1000;

// docs/TripNexio_UAE_Visa_Extension_Final_Page_Content_Design_FAQ_FINAL.docx
// §12 FAQ: "One reminder is scheduled around Day 25 after a successful
// 30-day extension" — and §6 "New Extension Validity: Counted from the
// original visa expiry date". The original developer handover
// (TripNexio_Visa_Extension_Updated_Developer_Handover.docx) never
// mentions a reminder at all, so the FINAL content doc is the only source
// for the exact trigger. Read literally, "counted from the original visa
// expiry date" is the ONE date explicitly tied to "counted from" language
// for the new validity window, so REMINDER_DAY is measured from that date
// (Lead.details.visaExpiryDate, the customer-submitted original expiry),
// not from whenever the booking happened to reach CONFIRMED — a delayed
// booking would otherwise get an inaccurately-late reminder relative to
// when its actual 30-day window really ends. Flagged as a judgment call,
// not asserted as unambiguous from the docs.
const REMINDER_DAY = 25;
// The reminder is only meaningful for the 5 days before the 30-day window
// itself lapses (day 25-30) — outside that, either too early to matter or
// already past the point of being useful.
const RELEVANT_WINDOW_END_DAY = 30;
// P13 — one reminder per booking, ever: a 10-year lookback on the reminder log.
const REMINDER_COOLDOWN_MS = 3650 * DAY_MS;

/**
 * P13: measured from the staff-verified expiry (fallback: the customer's
 * date), sent at most once per booking, and skipped when the customer opted
 * out of follow-ups (Lead.followUpOptOut, via the unsubscribe link) or has
 * since completed another extension or started a visa change.
 *
 * Called by n8n's "Visa Extension: Day-25 Re-Extension Reminder" workflow
 * — Item 10, client-message/PENDING_WORK_PROMPTS.md. Finds successfully
 * completed (payment received) Visa Extension bookings whose original
 * visa-expiry date (the basis the new 30-day extension validity is
 * "counted from," per the doc) is 25-30 days in the past, and sends a
 * VISA_EXTENSION_REMINDER nudge once per booking.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("visa-extension-reminder", async () => {
      const bookings = await db.booking.findMany({
        where: {
          status: { in: ["CONFIRMED", "PROCESSING", "COMPLETED"] },
          lead: { serviceType: "VISA_EXTENSION", followUpOptOut: false },
          // A Not Accepted / Rejected extension never gets a re-extension nudge.
          OR: [{ extensionOutcome: null }, { extensionOutcome: "EXTENDED" }],
        },
        include: { lead: true, customer: true },
      });

      const now = Date.now();
      let bookingsChecked = 0;
      let remindersSent = 0;

      for (const booking of bookings) {
        // P13 — anchored on the staff-verified expiry, falling back to the customer's own date.
        const details = (booking.lead.details as Record<string, unknown> | null) ?? {};
        const visaExpiryRaw = typeof details.verifiedExpiryDate === "string" && details.verifiedExpiryDate ? details.verifiedExpiryDate : details.visaExpiryDate;
        if (typeof visaExpiryRaw !== "string") continue;
        const visaExpiryDate = new Date(visaExpiryRaw);
        if (Number.isNaN(visaExpiryDate.getTime())) continue;

        const daysSinceExpiry = (now - visaExpiryDate.getTime()) / DAY_MS;
        if (daysSinceExpiry < REMINDER_DAY || daysSinceExpiry > RELEVANT_WINDOW_END_DAY) continue;

        bookingsChecked++;

        const alreadyReminded = await wasRecentlyReminded("VISA_EXTENSION_REMINDER", "Booking", booking.id, REMINDER_COOLDOWN_MS);
        if (alreadyReminded) continue;

        // P13 — stop once the customer has moved on: a later completed
        // extension, or a later visa change (not cancelled/refunded).
        const movedOn = await db.booking.findFirst({
          where: {
            customerId: booking.customerId,
            id: { not: booking.id },
            createdAt: { gt: booking.createdAt },
            OR: [
              { lead: { serviceType: "VISA_EXTENSION" }, status: "COMPLETED" },
              { lead: { serviceType: "VISA_CHANGE" }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
            ],
          },
          select: { id: true },
        });
        if (movedOn) continue;

        const extensionExpiry = new Date(visaExpiryDate.getTime() + RELEVANT_WINDOW_END_DAY * DAY_MS);

        await notifyCustomer({
          event: NOTIFICATION_EVENTS.VISA_EXTENSION_REMINDER,
          emailTo: booking.customer.email,
          whatsappTo: toWhatsAppId(booking.customer.mobile),
          smsTo: toWhatsAppId(booking.customer.mobile),
          variables: {
            customerName: booking.customer.name,
            bookingId: booking.bookingId,
            extensionExpiryDate: extensionExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
            unsubscribeLink: booking.lead.customerToken ? `${siteConfig.url}/follow-ups/stop/${booking.lead.customerToken}` : "",
          },
          auditTarget: { entityType: "Booking", entityId: booking.id },
        });
        await logReminder("VISA_EXTENSION_REMINDER", "Booking", booking.id);
        remindersSent++;
      }

      return { bookingsChecked, remindersSent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/visa-extension-reminder]", error);
    return jsonError(500, "Visa Extension reminder job failed.");
  }
}

/** P26 — Vercel Cron calls this with GET (see vercel.json); same handler and auth as n8n's POST. */
export const GET = POST;
