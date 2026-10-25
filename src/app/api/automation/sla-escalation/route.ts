import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { verifyAutomationKey } from "@/lib/automation/auth";
import { recordAutomationRun } from "@/lib/automation/record-run";
import { logReminder, wasRecentlyReminded } from "@/lib/automation/reminder-log";
import { notifyStaff } from "@/lib/staff-notifications/notify";
import { TERMINAL_BOOKING_STATUSES } from "@/lib/staff/workload";
import { ESCALATE_TO_PERMISSION, ESCALATE_TO_VALUES, type EscalateTo } from "@/lib/validation/escalation-rule-schema";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getOpenDelayRecords } from "@/lib/crm/delays";
import type { Prisma } from "@/generated/prisma/client";

const HOUR_MS = 60 * 60 * 1000;
/** Bookings examined per rule per run — keeps each run's queries modest. */
const BOOKINGS_PER_RULE = 300;
/**
 * The dedupe key already pins one escalation to one stay in one status
 * (it includes the moment the booking entered that status), so the
 * look-back only needs to be "forever" in practice.
 */
const DEDUPE_LOOKBACK_MS = 3650 * 24 * HOUR_MS;
const EVENT_PREFIX = "SLA_ESCALATION";
/** Timeline-based escalations sent per run — a large backlog drains over a few hourly runs instead of one burst. */
const TIMELINE_ESCALATIONS_PER_RUN = 50;

function isEscalateTo(value: string): value is EscalateTo {
  return (ESCALATE_TO_VALUES as readonly string[]).includes(value);
}

/**
 * P24 — Admin → SLA Escalation, called by n8n's "SLA Escalation" workflow
 * (hourly). For each active EscalationRule:
 *  - bookings that aren't COMPLETED/CANCELLED/REFUNDED, of the rule's
 *    service (any when null), currently on the rule's status — or, when the
 *    rule has no status, on any non-terminal service status (or none yet);
 *  - time in status = now − the booking's latest SERVICE_STATUS_CHANGE
 *    audit row, else its createdAt;
 *  - past `hoursInStatus` → notifyStaff(DELAY) to staff.manage (MANAGERS) or
 *    admin.full (ADMINS) holders scoped to the service, plus an
 *    SLA_ESCALATED audit row on the booking.
 * Dedupe: AutomationReminderLog keyed by (rule, status, time the booking
 * entered it) + booking id, so each stay in a status escalates once per
 * rule; leaving and re-entering the status starts a new stay.
 */
export async function POST(request: NextRequest) {
  if (!verifyAutomationKey(request)) return jsonError(401, "Unauthorized.");

  try {
    const summary = await recordAutomationRun("sla-escalation", async () => {
      const now = Date.now();
      const rules = await db.escalationRule.findMany({ where: { active: true }, orderBy: { createdAt: "asc" }, take: 100 });

      /** bookingId → when it entered its current status (memoised across rules). */
      const enteredAtCache = new Map<string, Date>();
      let bookingsChecked = 0;
      let escalated = 0;
      let skippedInvalidRules = 0;

      for (const rule of rules) {
        if (!isEscalateTo(rule.escalateTo)) {
          skippedInvalidRules++;
          continue;
        }
        const escalateTo: EscalateTo = rule.escalateTo;
        const thresholdMs = rule.hoursInStatus * HOUR_MS;

        const where: Prisma.BookingWhereInput = {
          status: { notIn: TERMINAL_BOOKING_STATUSES },
          // Time in status can never exceed the booking's age — a cheap pre-filter.
          createdAt: { lte: new Date(now - thresholdMs) },
          ...(rule.serviceType ? { lead: { serviceType: rule.serviceType } } : {}),
          ...(rule.serviceStatusId
            ? { serviceStatusId: rule.serviceStatusId }
            : { OR: [{ serviceStatusId: null }, { serviceStatus: { isTerminal: false } }] }),
        };

        const bookings = await db.booking.findMany({
          where,
          select: {
            id: true,
            bookingId: true,
            createdAt: true,
            serviceStatusId: true,
            serviceStatus: { select: { name: true } },
            lead: { select: { serviceType: true } },
          },
          orderBy: { createdAt: "asc" },
          take: BOOKINGS_PER_RULE,
        });
        bookingsChecked += bookings.length;
        if (bookings.length === 0) continue;

        const uncached = bookings.filter((booking) => !enteredAtCache.has(booking.id)).map((booking) => booking.id);
        if (uncached.length > 0) {
          const latest = await db.auditTrail.groupBy({
            by: ["entityId"],
            where: { entityType: "Booking", action: "SERVICE_STATUS_CHANGE", entityId: { in: uncached } },
            _max: { timestamp: true },
          });
          const latestById = new Map(latest.map((row) => [row.entityId, row._max.timestamp]));
          for (const booking of bookings) {
            if (enteredAtCache.has(booking.id)) continue;
            enteredAtCache.set(booking.id, latestById.get(booking.id) ?? booking.createdAt);
          }
        }

        for (const booking of bookings) {
          const enteredAt = enteredAtCache.get(booking.id) ?? booking.createdAt;
          const elapsedMs = now - enteredAt.getTime();
          if (elapsedMs <= thresholdMs) continue;

          const statusKey = booking.serviceStatusId ?? "none";
          const event = `${EVENT_PREFIX}:${rule.id}:${statusKey}:${enteredAt.getTime()}`;
          if (await wasRecentlyReminded(event, "Booking", booking.id, DEDUPE_LOOKBACK_MS)) continue;

          const hours = Math.floor(elapsedMs / HOUR_MS);
          const statusName = booking.serviceStatus?.name ?? "no status";
          const permission = ESCALATE_TO_PERMISSION[escalateTo];

          await notifyStaff({
            type: "DELAY",
            title: `Escalation: ${booking.bookingId} in ${statusName} for ${hours} h`,
            body: `${SERVICE_TYPE_LABELS[booking.lead.serviceType]} — over the ${rule.hoursInStatus} h SLA escalation limit`,
            link: `/crm/bookings/${booking.id}`,
            entityType: "Booking",
            entityId: booking.id,
            recipients: { permission, serviceType: booking.lead.serviceType },
          });
          await writeAudit(db, {
            entityType: "Booking",
            entityId: booking.id,
            action: "SLA_ESCALATED",
            note: `In "${statusName}" for ${hours} h (limit ${rule.hoursInStatus} h) — escalated to ${escalateTo === "ADMINS" ? "admins" : "managers"} (rule ${rule.id}, via automation)`,
          });
          await logReminder(event, "Booking", booking.id);
          escalated++;
        }
      }

      // Admin handover §6 — "use configured timelines for SLA tracking, reminders and escalation": a booking past
      // its expected completion (Admin → Timelines, service value or the lead's country timeline — the same
      // definition as /crm/delays) escalates to managers once per deadline. The assigned staff get the weekly
      // DELAY reminder from the staff-alerts job; this is the manager-level step.
      const timelineDelays = (await getOpenDelayRecords()).filter((record) => record.type === "COMPLETION_SLA");
      let timelineEscalated = 0;
      for (const record of timelineDelays) {
        if (timelineEscalated >= TIMELINE_ESCALATIONS_PER_RUN) break;
        const event = `${EVENT_PREFIX}:TIMELINE:${record.dueAt}`;
        if (await wasRecentlyReminded(event, "Booking", record.bookingId, DEDUPE_LOOKBACK_MS)) continue;
        const hours = Math.floor(record.delayHours);
        await notifyStaff({
          type: "DELAY",
          title: `Escalation: ${record.bookingReference} is ${hours} h past its expected completion`,
          body: `${record.serviceLabel} — over the configured completion timeline`,
          link: `/crm/bookings/${record.bookingId}`,
          entityType: "Booking",
          entityId: record.bookingId,
          recipients: { permission: ESCALATE_TO_PERMISSION.MANAGERS, serviceType: record.serviceType },
        });
        await writeAudit(db, {
          entityType: "Booking",
          entityId: record.bookingId,
          action: "SLA_ESCALATED",
          note: `${hours} h past the expected completion timeline (due ${record.dueAt}) — escalated to managers (Timeline Control, via automation)`,
        });
        await logReminder(event, "Booking", record.bookingId);
        timelineEscalated++;
      }

      return { rulesChecked: rules.length, skippedInvalidRules, bookingsChecked, escalated, timelineDelaysChecked: timelineDelays.length, timelineEscalated };
    });

    return jsonSuccess(summary);
  } catch (error) {
    console.error("[automation/sla-escalation]", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "SLA escalation job failed.");
  }
}

/** P26 — Vercel Cron calls this with GET (see vercel.json); same handler and auth as n8n's POST. */
export const GET = POST;
