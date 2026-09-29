import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { getServiceTimelineRules } from "@/lib/settings/service-timeline-config";
import { applySystemEvent, dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";

const DAY_MS = 24 * 60 * 60 * 1000;
const DELIVERED_OUTPUTS = ["RESERVATION_PDF", "TICKET_PDF"];

/**
 * P17 — Return_Verified_Ticket.md §21: a Return Verified Ticket booking
 * moves to Completed once its ticket/reservation PDF has been delivered and
 * the travel date has passed plus the Admin-configured number of days
 * (Admin → Timelines, "Auto-complete: days after travel date"; 0 when not
 * set). Forward-only through the status engine: a booking on hold, in an
 * exception status, or already completed is left alone.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("return-ticket-auto-complete", async () => {
      const rules = await getServiceTimelineRules("RETURN_TICKET");
      const graceDays = rules.autoCompleteAfterDays ?? 0;
      const bookings = await db.booking.findMany({
        where: {
          lead: { serviceType: "RETURN_TICKET" },
          status: { in: ["CONFIRMED", "PROCESSING"] },
          documents: { some: { type: { in: DELIVERED_OUTPUTS }, deliveredAt: { not: null } } },
        },
        select: { id: true, lead: { select: { details: true } } },
      });

      const now = Date.now();
      let bookingsChecked = 0;
      let completed = 0;
      const notifications: (StatusNotification | null)[] = [];

      for (const booking of bookings) {
        const travelDateRaw = (booking.lead.details as Record<string, unknown> | null)?.travelDate;
        const travelDate = typeof travelDateRaw === "string" ? new Date(travelDateRaw) : null;
        if (!travelDate || Number.isNaN(travelDate.getTime())) continue;
        bookingsChecked++;
        // The whole travel day has to be over before the grace period starts.
        if (now < travelDate.getTime() + DAY_MS + graceDays * DAY_MS) continue;

        const notification = await db.$transaction((tx) =>
          applySystemEvent(tx, { scope: "BOOKING", entityId: booking.id, event: "RT_AUTO_COMPLETED", actorLabel: "automatic completion after travel" })
        );
        const after = await db.booking.findUnique({ where: { id: booking.id }, select: { status: true } });
        if (after?.status === "COMPLETED") completed++;
        notifications.push(notification);
      }

      await dispatchStatusNotifications(notifications);
      return { graceDays, bookingsChecked, completed };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/return-ticket-auto-complete]", error);
    return jsonError(500, "Return Ticket auto-complete job failed.");
  }
}
