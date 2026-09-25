import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { formatLeadReference } from "@/lib/leads/reference";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

const LOOKAHEAD_DAYS = 7;
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Called by n8n's "OTB Requirement Checks" workflow — as an OTB traveler's
 * date approaches, re-checks whether documents attached to their booking
 * are still outstanding (REQUIRED/MISSING, not yet RECEIVED/VERIFIED) and
 * re-sends DOCUMENTS_REQUIRED (reusing the same event the CRM's own
 * document-status route already triggers on creation/MISSING — this is
 * just a periodic re-nudge as the deadline nears, not a new notification
 * type) if one hasn't gone out in the last day for that specific document.
 *
 * Scoped to documents already attached to a Booking (not a passport photo
 * uploaded at initial lead intake before a booking exists — see
 * Document.bookingId) since that's the only way to reach the OTB lead's
 * travelDate relationally. OTB never captures nationality (a locked
 * business rule — see createLeadFromSubmission), so this can't use
 * DocumentRequirement's per-nationality checklist the way other services
 * could; it works off whatever Document rows already exist for the booking.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("otb-requirement-check", async () => {
      const bookings = await db.booking.findMany({
        where: { lead: { serviceType: "OTB" } },
        include: { lead: true, customer: true, documents: true },
      });

      const now = Date.now();
      const windowMs = LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
      let bookingsChecked = 0;
      let remindersSent = 0;

      for (const booking of bookings) {
        const travelDateRaw = (booking.lead.details as Record<string, unknown> | null)?.travelDate;
        if (typeof travelDateRaw !== "string") continue;
        const travelDate = new Date(travelDateRaw);
        if (Number.isNaN(travelDate.getTime())) continue;

        const msUntilTravel = travelDate.getTime() - now;
        if (msUntilTravel < 0 || msUntilTravel > windowMs) continue;

        bookingsChecked++;
        const outstanding = booking.documents.filter((doc) => doc.status === "REQUIRED" || doc.status === "MISSING");

        for (const doc of outstanding) {
          const alreadyReminded = await wasRecentlyReminded("DOCUMENTS_REQUIRED", "Document", doc.id, REMINDER_COOLDOWN_MS);
          if (alreadyReminded) continue;

          await notifyCustomer({
            event: NOTIFICATION_EVENTS.DOCUMENTS_REQUIRED,
            emailTo: booking.customer.email,
            whatsappTo: toWhatsAppId(booking.customer.mobile),
            smsTo: toWhatsAppId(booking.customer.mobile),
            variables: {
              customerName: booking.customer.name,
              documentName: doc.type,
              leadReference: formatLeadReference(booking.lead.serviceType, booking.leadId),
            },
            auditTarget: { entityType: "Document", entityId: doc.id },
          });
          await logReminder("DOCUMENTS_REQUIRED", "Document", doc.id);
          remindersSent++;
        }
      }

      return { bookingsChecked, remindersSent };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/otb-requirement-check]", error);
    return jsonError(500, "OTB requirement check job failed.");
  }
}
