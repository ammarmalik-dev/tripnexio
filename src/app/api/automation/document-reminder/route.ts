import { isAutomationEnabled, localClock } from "@/lib/automation/settings";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { NOT_ON_HOLD_WHERE, NO_OPEN_REFUND_WHERE } from "@/lib/automation/active-booking-where";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { leadReference } from "@/lib/leads/reference";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";
import { ensureLeadCustomerToken } from "@/lib/quotations/select-quotation";
import { OUTPUT_TYPES } from "@/lib/outputs/output-types";
import { documentDisplayName, documentsByPassengerSummary } from "@/lib/documents/review-round";

const REMINDER_EVENT = "DOCUMENT_REMINDER";
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * P11 — called daily by n8n's "Document Reminders" workflow, for every
 * service: a booking still waiting on any customer document (REQUIRED,
 * MISSING or REJECTED) gets one DOCUMENTS_REQUIRED reminder per 24 hours,
 * listing what's outstanding with the secure upload link. It stops by
 * itself once the documents are uploaded or verified, and never goes to a
 * cancelled/refunded/completed booking, a closed lead, or a booking on a
 * terminal status. The 24h spacing is enforced here (AutomationReminderLog),
 * not by the schedule.
 */
/** Client doc 16 Nov (N4) — local hours the document reminder goes out. */
const DOCUMENT_REMINDER_HOURS = [12, 17];

export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("document-reminder", async () => {
      const bookings = await db.booking.findMany({
        where: {
          status: { notIn: ["CANCELLED", "REFUNDED", "COMPLETED"] },
          // Client doc 16 Nov (N14) — no reminders once the customer stopped them for this booking.
          lead: { status: { notIn: ["LOST", "CLOSED"] }, followUpOptOut: false },
          // H13 — never while a refund is open or the booking is On Hold.
          AND: [NOT_ON_HOLD_WHERE, NO_OPEN_REFUND_WHERE],
          documents: { some: { status: { in: ["REQUIRED", "MISSING", "REJECTED"] }, type: { notIn: [...OUTPUT_TYPES] } } },
        },
        include: {
          lead: true,
          customer: true,
          documents: {
            where: { status: { in: ["REQUIRED", "MISSING", "REJECTED"] }, type: { notIn: [...OUTPUT_TYPES] } },
            select: { type: true, passengerId: true, passenger: { select: { fullName: true } } },
          },
        },
      });

      let remindersSent = 0;
      // Client doc 16 Nov (N1 / N4) — at 12:00 PM and 5:00 PM local time only, while Admin keeps it on; once per slot.
      const clock = await localClock();
      if (!(await isAutomationEnabled("DOCUMENT_REMINDER")) || !DOCUMENT_REMINDER_HOURS.includes(clock.hour)) {
        return { bookingsWaiting: bookings.length, remindersSent, skipped: "outside the 12:00 / 17:00 slots or switched off" };
      }
      const slotEvent = `${REMINDER_EVENT}:${clock.date}:${clock.hour}`;
      for (const booking of bookings) {
        if (await wasRecentlyReminded(slotEvent, "Booking", booking.id, REMINDER_COOLDOWN_MS)) continue;
        // Client doc 2026-10-15 (I6) — which passenger needs which document.
        const multiplePassengers = new Set(booking.documents.map((doc) => doc.passengerId)).size > 1;
        const seen = new Set<string>();
        const outstanding = booking.documents.filter((doc) => {
          const key = `${doc.passengerId}|${doc.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // Client doc 16 Nov (N4) — the separate Document Reminder template (the request itself has its own).
        await notifyCustomer({
          event: NOTIFICATION_EVENTS.DOCUMENT_REMINDER,
          emailTo: booking.customer.email,
          whatsappTo: toWhatsAppId(booking.customer.mobile),
          smsTo: toWhatsAppId(booking.customer.mobile),
          variables: {
            customerName: booking.customer.name,
            documentName: documentsByPassengerSummary(
              outstanding.map((doc) => ({ passengerName: multiplePassengers ? (doc.passenger?.fullName ?? null) : null, label: documentDisplayName(doc.type) }))
            ),
            leadReference: leadReference(booking.lead),
            bookingId: booking.bookingId,
            serviceName: SERVICE_TYPE_LABELS[booking.lead.serviceType],
            uploadLink: booking.customerToken ? `${siteConfig.url}/pay/${booking.customerToken}#documents` : `${siteConfig.url}/account`,
            unsubscribeLink: `${siteConfig.url}/follow-ups/stop/${await ensureLeadCustomerToken(booking.lead)}`,
          },
          auditTarget: { entityType: "Booking", entityId: booking.id },
        });
        await logReminder(slotEvent, "Booking", booking.id);
        remindersSent++;
      }

      return { bookingsWaiting: bookings.length, remindersSent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/document-reminder]", error);
    return jsonError(500, "Document reminder job failed.");
  }
}

/** P26 — Vercel Cron calls this with GET (see vercel.json); same handler and auth as n8n's POST. */
export const GET = POST;
