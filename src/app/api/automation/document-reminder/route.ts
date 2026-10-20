import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { sendDocumentsStatusTemplate } from "@/lib/notifications/status-template";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { leadReference } from "@/lib/leads/reference";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";
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
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("document-reminder", async () => {
      const bookings = await db.booking.findMany({
        where: {
          status: { notIn: ["CANCELLED", "REFUNDED", "COMPLETED"] },
          lead: { status: { notIn: ["LOST", "CLOSED"] } },
          OR: [{ serviceStatusId: null }, { serviceStatus: { isTerminal: false } }],
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
      for (const booking of bookings) {
        if (await wasRecentlyReminded(REMINDER_EVENT, "Booking", booking.id, REMINDER_COOLDOWN_MS)) continue;
        // Client doc 2026-10-15 (I6) — which passenger needs which document.
        const multiplePassengers = new Set(booking.documents.map((doc) => doc.passengerId)).size > 1;
        const seen = new Set<string>();
        const outstanding = booking.documents.filter((doc) => {
          const key = `${doc.passengerId}|${doc.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // Client doc 2026-10-20 — services on the client's templates get their own "Documents Pending" message.
        if (await sendDocumentsStatusTemplate(booking.id, "REQUESTED")) {
          await logReminder(REMINDER_EVENT, "Booking", booking.id);
          remindersSent++;
          continue;
        }
        await notifyCustomer({
          event: NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
          emailTo: booking.customer.email,
          whatsappTo: toWhatsAppId(booking.customer.mobile),
          smsTo: toWhatsAppId(booking.customer.mobile),
          variables: {
            customerName: booking.customer.name,
            documentName: documentsByPassengerSummary(
              outstanding.map((doc) => ({ passengerName: multiplePassengers ? (doc.passenger?.fullName ?? null) : null, label: documentDisplayName(doc.type) }))
            ),
            leadReference: leadReference(booking.lead),
            requestReason: "",
            uploadLink: booking.customerToken ? `${siteConfig.url}/pay/${booking.customerToken}` : `${siteConfig.url}/account`,
          },
          auditTarget: { entityType: "Booking", entityId: booking.id },
        });
        await logReminder(REMINDER_EVENT, "Booking", booking.id);
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
