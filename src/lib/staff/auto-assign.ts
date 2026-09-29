import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getTimezoneOffsetMinutes } from "@/lib/settings/system-config";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getStaffIdsOnApprovedLeave, isRosterEligible } from "./eligible-for-assignment";
import { getStaffWorkloads } from "./workload";
import type { ServiceType } from "../../generated/prisma/enums";

const SYSTEM_CONFIG_ID = "singleton";

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Today's weekday (0 = Sunday ... 6) in the Admin-configured timezone, not the server's. */
export function weekdayInAdminTimezone(offsetMinutes: number, now: Date = new Date()): number {
  return new Date(now.getTime() + offsetMinutes * 60_000).getUTCDay();
}

export interface AutoAssignResult {
  staffId: string;
  staffName: string;
  reason: string;
}

/**
 * P22 item 8 — ADMIN.md §13 "Automatic Assignment" for a freshly submitted
 * lead. Runs AFTER the lead's own transaction commits (uses the global
 * client, never inside an open transaction). Never throws — a failure here
 * must not turn an otherwise-successful submission into an error.
 *
 * Algorithm:
 *  1. Off unless SystemConfig.autoAssignLeads is true.
 *  2. Skip if the lead is gone, already assigned, or still an abandoned
 *     draft (drafts are only assigned once the full form completes them).
 *  3. Candidates = active StaffRoster rows for the lead's serviceType on
 *     today's weekday (Admin timezone), ordered by roster row createdAt.
 *  4. Keep only roster-eligible staff (active, leads.edit, service scope —
 *     `isRosterEligible`) who are not on approved leave today.
 *  5. Pick the lowest PAX workload (`getStaffWorkloads`); ties → fewest
 *     open leads → earliest roster row.
 *  6. Conditional update (only while still unassigned, so a staff member
 *     who claimed it in the meantime wins) + an AUTO_ASSIGN audit row.
 *  No eligible candidate → the lead stays unassigned, no error.
 */
export async function autoAssignLead(leadId: string, serviceType: ServiceType): Promise<AutoAssignResult | null> {
  try {
    const config = await db.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { autoAssignLeads: true } });
    if (!config?.autoAssignLeads) return null;

    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { assignedStaffId: true, details: true } });
    if (!lead || lead.assignedStaffId) return null;
    const details = lead.details as Record<string, unknown> | null;
    if (details && details.abandonedDraft === true) return null;

    const offsetMinutes = await getTimezoneOffsetMinutes(db);
    const dayOfWeek = weekdayInAdminTimezone(offsetMinutes);

    const rosterRows = await db.staffRoster.findMany({
      where: { serviceType, dayOfWeek, active: true, user: { active: true } },
      include: { user: { include: { role: { include: { permissions: true } } } } },
      orderBy: { createdAt: "asc" },
    });
    if (rosterRows.length === 0) return null;

    const onLeave = await getStaffIdsOnApprovedLeave();
    const seen = new Set<string>();
    const candidates = rosterRows.filter((row) => {
      if (seen.has(row.userId)) return false;
      seen.add(row.userId);
      return !onLeave.has(row.userId) && isRosterEligible(row.user, serviceType);
    });
    if (candidates.length === 0) return null;

    const workloads = await getStaffWorkloads(candidates.map((row) => row.userId));
    const ranked = candidates
      .map((row, rosterIndex) => ({ row, rosterIndex, workload: workloads.get(row.userId)! }))
      .sort(
        (a, b) =>
          a.workload.paxCount - b.workload.paxCount ||
          a.workload.openLeadCount - b.workload.openLeadCount ||
          a.rosterIndex - b.rosterIndex
      );
    const chosen = ranked[0];

    const reason =
      `Auto-assigned to ${chosen.row.user.name}: rostered for ${SERVICE_TYPE_LABELS[serviceType]} on ${WEEKDAY_LABELS[dayOfWeek]}, ` +
      `lowest PAX workload (${chosen.workload.paxCount} PAX across ${chosen.workload.openLeadCount} open lead(s), ` +
      `${chosen.workload.openBookingCount} open booking(s)) among ${candidates.length} eligible rostered staff`;

    const assigned = await db.$transaction(async (tx) => {
      const updated = await tx.lead.updateMany({
        where: { id: leadId, assignedStaffId: null },
        data: { assignedStaffId: chosen.row.userId },
      });
      if (updated.count === 0) return false;
      await writeAudit(tx, { entityType: "Lead", entityId: leadId, action: "AUTO_ASSIGN", note: reason });
      return true;
    });
    if (!assigned) return null;

    return { staffId: chosen.row.userId, staffName: chosen.row.user.name, reason };
  } catch (error) {
    console.error("[staff/auto-assign] auto-assignment failed; lead left unassigned", error);
    return null;
  }
}
