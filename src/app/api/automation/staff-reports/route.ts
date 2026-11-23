import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { logReminder, wasRecentlyReminded } from "@/lib/automation/reminder-log";
import { isAutomationEnabled, localClock } from "@/lib/automation/settings";
import { getOpenDelayRecords } from "@/lib/crm/delays";
import { buildActionSections, buildAdminSections, sectionsToHtml, sectionsToSheets, type ReportSection } from "@/lib/reports/staff-reports";
import { buildXlsx } from "@/lib/excel/xlsx";
import { sendStaffEmail } from "@/lib/staff-notifications/staff-email";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Client doc 16 Nov (N11) — staff alert hours, with how far back "new" reaches (the previous alert). */
const STAFF_ALERT_SINCE_HOURS: Record<number, number> = { 11: 17, 15: 4, 18: 3 };
const ADMIN_DAILY_HOUR = 20;
const WEEKLY_HOUR = 12;
const MONDAY = 1;

const attachment = (name: string, sections: ReportSection[]) => ({ filename: name, content: Buffer.from(buildXlsx(sectionsToSheets(sections))) });

/**
 * Client doc 16 Nov (N11–N13) — staff email reports, each with an Excel workbook (one tab per category, the same
 * data as the email), switched on / off in Admin → Automation. Runs hourly; sends only at its local hour, once.
 * - N11 at 11:00 AM, 3:00 PM and 6:00 PM: every POC gets one email with only their own action-required items
 *   (sales + operations); nothing is sent to a POC with nothing pending.
 * - N12 at 8:00 PM: Admin (admin.full) gets the day's report.
 * - N13 Monday 12:00 PM: Admin gets the last 7 days; every other staff member gets their own items for the week.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");
  try {
    const summary = await recordAutomationRun("staff-reports", async () => {
      const now = new Date();
      const clock = await localClock(now);
      const weekday = new Date(`${clock.date}T00:00:00Z`).getUTCDay();
      const result: Record<string, number | string> = { localDate: clock.date, localHour: clock.hour };
      const staff = await db.user.findMany({ where: { active: true }, select: { id: true, name: true, role: { select: { permissions: { select: { name: true } } } } } });
      const isAdmin = (user: (typeof staff)[number]) => user.role.permissions.some((permission) => permission.name === ADMIN_FULL_PERMISSION);

      // N11 — POC action-required alerts.
      const sinceHours = STAFF_ALERT_SINCE_HOURS[clock.hour];
      if (sinceHours && (await isAutomationEnabled("STAFF_ALERTS"))) {
        const since = new Date(now.getTime() - sinceHours * HOUR_MS);
        const delays = await getOpenDelayRecords();
        const key = `STAFF_ALERT:${clock.date}:${clock.hour}`;
        let sent = 0;
        for (const user of staff) {
          if (await wasRecentlyReminded(key, "User", user.id, DAY_MS)) continue;
          const sections = await buildActionSections({ userId: user.id, since, now, offsetMs: clock.offsetMs, delays });
          const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
          if (total === 0) continue;
          await sendStaffEmail({
            recipients: { userIds: [user.id] },
            subject: `Your action items — ${clock.date} ${String(clock.hour).padStart(2, "0")}:00 (${total})`,
            lines: [`Hi ${user.name}, here is everything waiting on you (only your own assigned items). The attached Excel has the full list.`],
            extraHtml: sectionsToHtml(sections),
            link: "/crm",
            attachments: [attachment(`action-items-${clock.date}-${clock.hour}.xlsx`, sections)],
          });
          await logReminder(key, "User", user.id);
          sent++;
        }
        result.staffAlerts = sent;
      }

      // N12 — Admin daily report.
      if (clock.hour === ADMIN_DAILY_HOUR && (await isAutomationEnabled("ADMIN_DAILY_REPORT"))) {
        const key = `ADMIN_DAILY_REPORT:${clock.date}`;
        if (!(await wasRecentlyReminded(key, "System", "admin-daily", DAY_MS))) {
          const from = new Date(Date.parse(`${clock.date}T00:00:00Z`) - clock.offsetMs);
          const sections = await buildAdminSections({ from, to: now, offsetMs: clock.offsetMs });
          result.adminDaily = await sendStaffEmail({
            recipients: { permission: ADMIN_FULL_PERMISSION },
            subject: `Daily report — ${clock.date}`,
            lines: [`TripNexio daily report for ${clock.date}. The attached Excel has one tab per category.`],
            extraHtml: sectionsToHtml(sections),
            link: "/admin/reports/management",
            attachments: [attachment(`daily-report-${clock.date}.xlsx`, sections)],
          });
          await logReminder(key, "System", "admin-daily");
        }
      }

      // N13 — weekly report, Monday 12:00 PM.
      if (weekday === MONDAY && clock.hour === WEEKLY_HOUR && (await isAutomationEnabled("WEEKLY_REPORT"))) {
        const key = `WEEKLY_REPORT:${clock.date}`;
        if (!(await wasRecentlyReminded(key, "System", "weekly", DAY_MS))) {
          const from = new Date(now.getTime() - 7 * DAY_MS);
          const sections = await buildAdminSections({ from, to: now, offsetMs: clock.offsetMs });
          result.weeklyAdmin = await sendStaffEmail({
            recipients: { permission: ADMIN_FULL_PERMISSION },
            subject: `Weekly sales & operations report — week to ${clock.date}`,
            lines: ["TripNexio weekly sales and operations report (last 7 days). The attached Excel has one tab per category."],
            extraHtml: sectionsToHtml(sections),
            link: "/admin/reports/management",
            attachments: [attachment(`weekly-report-${clock.date}.xlsx`, sections)],
          });
          // Team members: only their own items for the week.
          const delays = await getOpenDelayRecords();
          let team = 0;
          for (const user of staff.filter((row) => !isAdmin(row))) {
            const own = await buildActionSections({ userId: user.id, since: from, now, offsetMs: clock.offsetMs, delays });
            if (own.every((section) => section.rows.length === 0)) continue;
            await sendStaffEmail({
              recipients: { userIds: [user.id] },
              subject: `Your weekly summary — week to ${clock.date}`,
              lines: [`Hi ${user.name}, your own leads, bookings and pending work for the last 7 days.`],
              extraHtml: sectionsToHtml(own),
              link: "/crm",
              attachments: [attachment(`weekly-summary-${clock.date}.xlsx`, own)],
            });
            team++;
          }
          result.weeklyTeam = team;
          await logReminder(key, "System", "weekly");
        }
      }
      return result;
    });
    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/staff-reports]", error instanceof Error ? error.message : "error");
    return jsonError(500, "Staff report job failed.");
  }
}

/** Same handler for GET (Vercel Cron) and POST (n8n / VPS scheduler). */
export const GET = POST;
