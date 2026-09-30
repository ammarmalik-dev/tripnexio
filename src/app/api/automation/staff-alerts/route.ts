import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { wasRecentlyReminded, logReminder } from "@/lib/automation/reminder-log";
import { getOpenDelayRecords, type DelayRecord } from "@/lib/crm/delays";
import { notifyStaff } from "@/lib/staff-notifications/notify";
import { leadOwnerOrPermission } from "@/lib/staff-notifications/triggers";

const HOUR_MS = 60 * 60 * 1000;
/** A due/overdue task re-notifies at most once a day while it stays open. */
const FOLLOW_UP_COOLDOWN_MS = 20 * HOUR_MS;
/** A delayed booking re-notifies at most once a week while it stays delayed. */
const DELAY_COOLDOWN_MS = 7 * 24 * HOUR_MS;
/** Business day boundary — TripNexio operates on IST (UTC+5:30). */
const IST_OFFSET_MS = 330 * 60 * 1000;

const FOLLOW_UP_EVENT = "STAFF_FOLLOW_UP_DUE";
const DELAY_EVENT = "STAFF_DELAY";

/** The instant the current IST calendar day ends. */
function endOfTodayIst(now: Date): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(23, 59, 59, 999);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

function formatDueIst(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

/**
 * P22 — CRM.md §26 staff notifications that no request can trigger, called
 * by n8n's "Staff Alerts" workflow (hourly):
 * - FOLLOW_UP_DUE — an open task whose due date is today (IST) or already
 *   past, to its assignee (else the lead's assigned staff, else tasks.view
 *   for the service). At most once per task per day.
 * - DELAY — a booking with an open SLA delay (src/lib/crm/delays.ts, the
 *   same definition as /crm/delays), to the lead's assigned staff (else
 *   bookings.view for the service). At most once per booking per week.
 * The dedupe lives in AutomationReminderLog, so running this more often
 * never sends more.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("staff-alerts", async () => {
      const now = new Date();

      // --- FOLLOW_UP_DUE ----------------------------------------------------
      const dueTasks = await db.task.findMany({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lte: endOfTodayIst(now) } },
        select: {
          id: true,
          title: true,
          dueDate: true,
          assignedToId: true,
          leadId: true,
          bookingId: true,
          serviceType: true,
          lead: { select: { assignedStaffId: true, serviceType: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 500,
      });

      let followUpsNotified = 0;
      for (const task of dueTasks) {
        if (await wasRecentlyReminded(FOLLOW_UP_EVENT, "Task", task.id, FOLLOW_UP_COOLDOWN_MS)) continue;
        const serviceType = task.serviceType ?? task.lead?.serviceType ?? null;
        const assignee = task.assignedToId ?? task.lead?.assignedStaffId ?? null;
        const overdue = task.dueDate !== null && task.dueDate.getTime() < now.getTime();
        await notifyStaff({
          type: "FOLLOW_UP_DUE",
          title: `${overdue ? "Overdue" : "Due today"}: ${task.title}`,
          body: task.dueDate ? `Due ${formatDueIst(task.dueDate)}` : undefined,
          link: task.bookingId ? `/crm/bookings/${task.bookingId}` : task.leadId ? `/crm/leads/${task.leadId}` : "/crm/tasks",
          entityType: "Task",
          entityId: task.id,
          recipients: assignee ? { userIds: [assignee] } : { permission: "tasks.view", serviceType },
        });
        await logReminder(FOLLOW_UP_EVENT, "Task", task.id);
        followUpsNotified++;
      }

      // --- DELAY --------------------------------------------------------------
      const delays = await getOpenDelayRecords();
      const byBooking = new Map<string, DelayRecord[]>();
      for (const record of delays) {
        const list = byBooking.get(record.bookingId) ?? [];
        list.push(record);
        byBooking.set(record.bookingId, list);
      }

      let delaysNotified = 0;
      for (const [bookingId, records] of byBooking) {
        if (await wasRecentlyReminded(DELAY_EVENT, "Booking", bookingId, DELAY_COOLDOWN_MS)) continue;
        const first = records[0];
        const worst = Math.max(...records.map((record) => record.delayHours));
        const reasons = [...new Set(records.map((record) => (record.documentType ? `${record.reason} (${record.documentType})` : record.reason)))];
        await notifyStaff({
          type: "DELAY",
          title: `Delayed booking — ${first.bookingReference}`,
          body: `${first.serviceLabel} · ${first.customerName} — ${reasons.join(", ")}; ${worst}h past due`,
          link: `/crm/bookings/${bookingId}`,
          entityType: "Booking",
          entityId: bookingId,
          recipients: leadOwnerOrPermission({ assignedStaffId: first.staffId, serviceType: first.serviceType }, "bookings.view"),
        });
        await logReminder(DELAY_EVENT, "Booking", bookingId);
        delaysNotified++;
      }

      return {
        dueTasksChecked: dueTasks.length,
        followUpsNotified,
        delayedBookingsChecked: byBooking.size,
        delaysNotified,
      };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/staff-alerts]", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Staff alerts job failed.");
  }
}

/** P26 — Vercel Cron calls this with GET (see vercel.json); same handler and auth as n8n's POST. */
export const GET = POST;
