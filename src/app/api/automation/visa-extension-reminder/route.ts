import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

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
// One-shot: long enough that this job (running daily) can never send a
// second reminder for the same booking within the whole relevant window.
const REMINDER_COOLDOWN_MS = 45 * DAY_MS;

/**
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
        where: { status: { in: ["CONFIRMED", "PROCESSING", "COMPLETED"] }, lead: { serviceType: "VISA_EXTENSION" } },
        include: { lead: true, customer: true },
      });

      const now = Date.now();
      let bookingsChecked = 0;
      let remindersSent = 0;

      for (const booking of bookings) {
        const visaExpiryRaw = (booking.lead.details as Record<string, unknown> | null)?.visaExpiryDate;
        if (typeof visaExpiryRaw !== "string") continue;
        const visaExpiryDate = new Date(visaExpiryRaw);
        if (Number.isNaN(visaExpiryDate.getTime())) continue;

        const daysSinceExpiry = (now - visaExpiryDate.getTime()) / DAY_MS;
        if (daysSinceExpiry < REMINDER_DAY || daysSinceExpiry > RELEVANT_WINDOW_END_DAY) continue;

        bookingsChecked++;

        const alreadyReminded = await wasRecentlyReminded("VISA_EXTENSION_REMINDER", "Booking", booking.id, REMINDER_COOLDOWN_MS);
        if (alreadyReminded) continue;

        const extensionExpiry = new Date(visaExpiryDate.getTime() + RELEVANT_WINDOW_END_DAY * DAY_MS);

        await notifyCustomer({
          event: NOTIFICATION_EVENTS.VISA_EXTENSION_REMINDER,
          emailTo: booking.customer.email,
          whatsappTo: toWhatsAppId(booking.customer.mobile),
          variables: {
            customerName: booking.customer.name,
            bookingId: booking.bookingId,
            extensionExpiryDate: extensionExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
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
