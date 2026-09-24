import { db } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";
import { hasServiceAccess } from "@/lib/auth/service-scope";
import type { ServiceType } from "../../generated/prisma/enums";

export interface EligibleStaffMember {
  id: string;
  name: string;
}

type StaffWithRole = {
  id: string;
  active: boolean;
  allowedServiceTypes: ServiceType[];
  role: { permissions: { name: string }[] };
};

/**
 * Step 26 Unit 3 (audit §3.11/§4.7) — ADMIN.md §13's roster: a staff
 * member with a current leave row is excluded, same as an inactive
 * account. `today` anchored to UTC midnight to match how the `@db.Date`
 * startDate/endDate columns are stored/compared (date-only, no
 * time-of-day component) — see feedback_pg_timestamp_local_time_parsing in
 * project memory for why this matters. Step 38: gated on status=APPROVED
 * — a staff-requested leave that's still PENDING (or was REJECTED) must
 * NOT exclude them, only a decided-and-approved one.
 *
 * Step 50 — pulled out of `getEligibleStaffForAssignment` so the manual
 * assignment picker (`GET /api/staff?service=`) and its server-side
 * enforcement (`PATCH /api/leads/[id]/assign`) can apply the exact same
 * on-leave exclusion as the auto-suggestion, instead of a looser one.
 */
export async function getStaffIdsOnApprovedLeave(): Promise<Set<string>> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const currentLeaves = await db.staffLeave.findMany({
    where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
    select: { userId: true },
  });
  return new Set(currentLeaves.map((leave) => leave.userId));
}

/**
 * Step 50 — the one shared "is this staff member on the roster for this
 * service" predicate: active, actually able to work leads (leads.edit or
 * admin.full — otherwise the roster could include an Admin account that
 * never services leads day to day), and, when `serviceType` is given, not
 * scoped out of it (Step 39's User.allowedServiceTypes). Does NOT check
 * leave — leave exclusion is a separate concern (see
 * `getStaffIdsOnApprovedLeave`) since it needs its own query and the two
 * are always used together but conceptually distinct.
 */
export function isRosterEligible(member: StaffWithRole, serviceType?: ServiceType): boolean {
  if (!member.active) return false;
  if (!hasPermission({ permissions: member.role.permissions.map((permission) => permission.name) }, "leads.edit")) return false;
  if (serviceType && !hasServiceAccess({ permissions: member.role.permissions.map((p) => p.name), allowedServiceTypes: member.allowedServiceTypes }, serviceType)) {
    return false;
  }
  return true;
}

/**
 * Step 26 Unit 2 (audit §3.11/§4.7) — who's a valid candidate for
 * auto-assignment at all, before workload even enters into it. ADMIN.md
 * §13 also lists service/country/capability matching as possible
 * assignment factors — Step 39 finally builds the service half of that
 * (country/other capability matching still isn't invented here).
 */
export async function getEligibleStaffForAssignment(serviceType?: ServiceType): Promise<EligibleStaffMember[]> {
  const staff = await db.user.findMany({
    where: { active: true },
    include: { role: { include: { permissions: true } } },
  });

  const staffIdsOnLeave = await getStaffIdsOnApprovedLeave();

  return staff
    .filter((member) => !staffIdsOnLeave.has(member.id))
    .filter((member) => isRosterEligible(member, serviceType))
    .map((member) => ({ id: member.id, name: member.name }));
}
