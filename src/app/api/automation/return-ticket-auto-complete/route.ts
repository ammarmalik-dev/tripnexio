import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { getServiceTimelineRules } from "@/lib/settings/service-timeline-config";

const DAY_MS = 24 * 60 * 60 * 1000;
const DELIVERED_OUTPUTS = ["RESERVATION_PDF", "TICKET_PDF"];

/**
 * P17 — Return_Verified_Ticket.md §21: a Return Verified Ticket booking
 * moves to Completed once its ticket/reservation PDF has been delivered and
 * the travel date has passed plus the Admin-configured number of days
 * (Admin → Timelines, "Auto-complete: days after travel date"; 0 when not
 * set). Forward-only through the status engine: a booking on hold, in an
 * exception status, or already completed is left alone.
 *
 * Client doc 16 Nov (N15): "Automatic Booking Completion after the travel date is NOT REQUIRED … continue using the
 * existing manual completion process." The job now only REPORTS the bookings past their travel date (`due`) so staff
 * can close them by hand; it never changes a status or notifies a customer.
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
      let due = 0;

      for (const booking of bookings) {
        const travelDateRaw = (booking.lead.details as Record<string, unknown> | null)?.travelDate;
        const travelDate = typeof travelDateRaw === "string" ? new Date(travelDateRaw) : null;
        if (!travelDate || Number.isNaN(travelDate.getTime())) continue;
        bookingsChecked++;
        // The whole travel day has to be over before the grace period starts.
        if (now < travelDate.getTime() + DAY_MS + graceDays * DAY_MS) continue;

        due++;
      }

      return { graceDays, bookingsChecked, due, completed: 0, reportOnly: true };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/return-ticket-auto-complete]", error);
    return jsonError(500, "Return Ticket auto-complete job failed.");
  }
}

/** P26 — Vercel Cron calls this with GET (see vercel.json); same handler and auth as n8n's POST. */
export const GET = POST;
