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

/** The parts of an AssignmentRule the auto-assign algorithm reads. */
interface ApplicableRule {
  id: string;
  subServiceId: string | null;
  roleId: string | null;
  maxOpenLeads: number | null;
  priority: number;
}

function readString(details: Record<string, unknown> | null, key: string): string | null {
  const value = details?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * P24 item 6 — the lead's destination Country id, from its details:
 * `destinationCountryId` (Return Ticket, manual Return Ticket leads) as-is,
 * else `destinationCountry` / `destinationCountryCode` (a Country code on
 * New Visa/OTB/manual leads, or a name on older ones) matched
 * case-insensitively against Country.code, then Country.name. Null when
 * nothing resolves — such leads ignore countriesHandled entirely.
 */
export async function resolveLeadCountryId(details: Record<string, unknown> | null): Promise<string | null> {
  const directId = readString(details, "destinationCountryId");
  if (directId) return directId;
  const text = readString(details, "destinationCountry") ?? readString(details, "destinationCountryCode");
  if (!text) return null;
  const country = await db.country.findFirst({
    where: { OR: [{ code: { equals: text, mode: "insensitive" } }, { name: { equals: text, mode: "insensitive" } }] },
    select: { id: true },
  });
  return country?.id ?? null;
}

/**
 * P24 item 3 — the Admin assignment rules that apply to this lead: active
 * rules for its serviceType whose sub-service matches the lead's
 * `details.subServiceId`, plus the service-wide (null sub-service) rules.
 * A lead without a sub-service only gets the service-wide rules. Ordered
 * highest priority first; on a tie a sub-service-specific rule beats a
 * service-wide one, then the older rule wins.
 */
async function getApplicableRules(serviceType: ServiceType, subServiceId: string | null): Promise<ApplicableRule[]> {
  const rules = await db.assignmentRule.findMany({
    where: {
      serviceType,
      active: true,
      OR: subServiceId ? [{ subServiceId }, { subServiceId: null }] : [{ subServiceId: null }],
    },
    select: { id: true, subServiceId: true, roleId: true, maxOpenLeads: true, priority: true },
    orderBy: { createdAt: "asc" },
  });
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort(
      (a, b) =>
        b.rule.priority - a.rule.priority ||
        Number(b.rule.subServiceId !== null) - Number(a.rule.subServiceId !== null) ||
        a.index - b.index
    )
    .map(({ rule }) => rule);
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
 *  4b. P24 — countries handled: when the lead's destination country
 *     resolves (`resolveLeadCountryId`), drop staff whose non-empty
 *     `countriesHandled` doesn't include it (empty = every country). A lead
 *     with no resolvable country skips this filter.
 *  4c. P24 — assignment rules (`getApplicableRules`). No applicable rule →
 *     this step is skipped (the P22 behaviour). Otherwise rules are tried
 *     highest priority first; a rule's pool = candidates on its role (when
 *     set) with fewer open leads than its maxOpenLeads (when set). The
 *     first rule with a non-empty pool wins and only that pool goes on to
 *     step 5. If NO rule yields anyone the lead stays unassigned — the
 *     rules (e.g. a max-open-leads cap) are respected rather than silently
 *     falling back to an unrestricted pick.
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
    const details =
      typeof lead.details === "object" && lead.details !== null && !Array.isArray(lead.details)
        ? (lead.details as Record<string, unknown>)
        : null;
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
    const rostered = rosterRows.filter((row) => {
      if (seen.has(row.userId)) return false;
      seen.add(row.userId);
      return !onLeave.has(row.userId) && isRosterEligible(row.user, serviceType);
    });
    if (rostered.length === 0) return null;

    // 4b — countries handled.
    const countryId = await resolveLeadCountryId(details);
    const candidates = countryId
      ? rostered.filter((row) => row.user.countriesHandled.length === 0 || row.user.countriesHandled.includes(countryId))
      : rostered;
    if (candidates.length === 0) return null;

    const workloads = await getStaffWorkloads(candidates.map((row) => row.userId));
    const scored = candidates.map((row, rosterIndex) => ({ row, rosterIndex, workload: workloads.get(row.userId)! }));

    // 4c — assignment rules.
    const rules = await getApplicableRules(serviceType, readString(details, "subServiceId"));
    let pool = scored;
    let matchedRule: ApplicableRule | null = null;
    for (const rule of rules) {
      const rulePool = scored.filter(
        (entry) =>
          (rule.roleId === null || entry.row.user.roleId === rule.roleId) &&
          (rule.maxOpenLeads === null || entry.workload.openLeadCount < rule.maxOpenLeads)
      );
      if (rulePool.length > 0) {
        pool = rulePool;
        matchedRule = rule;
        break;
      }
    }
    if (rules.length > 0 && !matchedRule) return null;

    const ranked = [...pool].sort(
      (a, b) =>
        a.workload.paxCount - b.workload.paxCount ||
        a.workload.openLeadCount - b.workload.openLeadCount ||
        a.rosterIndex - b.rosterIndex
    );
    const chosen = ranked[0];

    const ruleNote = matchedRule
      ? `; assignment rule ${matchedRule.id} (priority ${matchedRule.priority}` +
        `${matchedRule.roleId ? `, role ${chosen.row.user.role.name}` : ""}` +
        `${matchedRule.maxOpenLeads !== null ? `, fewer than ${matchedRule.maxOpenLeads} open leads` : ""})`
      : "";
    const countryNote = countryId ? `; destination country ${countryId} within countries handled` : "";

    const reason =
      `Auto-assigned to ${chosen.row.user.name}: rostered for ${SERVICE_TYPE_LABELS[serviceType]} on ${WEEKDAY_LABELS[dayOfWeek]}, ` +
      `lowest PAX workload (${chosen.workload.paxCount} PAX across ${chosen.workload.openLeadCount} open lead(s), ` +
      `${chosen.workload.openBookingCount} open booking(s)) among ${pool.length} eligible rostered staff` +
      ruleNote +
      countryNote;

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
