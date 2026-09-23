import { db } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";
import { hasServiceAccess } from "@/lib/auth/service-scope";
import type { ServiceType } from "../../generated/prisma/enums";

export interface EligibleStaffMember {
  id: string;
  name: string;
}

/**
 * Step 26 Unit 2 (audit §3.11/§4.7) — who's a valid candidate for
 * auto-assignment at all, before workload even enters into it: active, and
 * actually able to work leads (leads.edit or admin.full) — otherwise the
 * "least loaded staff member" could be an Admin account that never
 * services leads day to day, which isn't what "least loaded" is supposed
 * to mean. ADMIN.md §13 also lists service/country/capability matching as
 * possible assignment factors — Step 39 finally builds the service half of
 * that (country/other capability matching still isn't invented here): when
 * `serviceType` is given, a staff member scoped out of it (Step 39's
 * User.allowedServiceTypes) is excluded from the candidate list exactly
 * like an inactive or on-leave one.
 */
export async function getEligibleStaffForAssignment(serviceType?: ServiceType): Promise<EligibleStaffMember[]> {
  const staff = await db.user.findMany({
    where: { active: true },
    include: { role: { include: { permissions: true } } },
  });

  // Step 26 Unit 3 (audit §3.11/§4.7) — ADMIN.md §13's roster: a staff
  // member with a current leave row is excluded from suggestions, same as
  // an inactive account. `today` anchored to UTC midnight to match how the
  // `@db.Date` startDate/endDate columns are stored/compared (date-only,
  // no time-of-day component) — see feedback_pg_timestamp_local_time_parsing
  // in project memory for why this matters. Step 38: gated on
  // status=APPROVED — a staff-requested leave that's still PENDING (or was
  // REJECTED) must NOT exclude them, only a decided-and-approved one.
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const currentLeaves = await db.staffLeave.findMany({
    where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
    select: { userId: true },
  });
  const staffIdsOnLeave = new Set(currentLeaves.map((leave) => leave.userId));

  return staff
    .filter((member) => !staffIdsOnLeave.has(member.id))
    .filter((member) => hasPermission({ permissions: member.role.permissions.map((permission) => permission.name) }, "leads.edit"))
    .filter(
      (member) =>
        !serviceType ||
        hasServiceAccess({ permissions: member.role.permissions.map((p) => p.name), allowedServiceTypes: member.allowedServiceTypes }, serviceType)
    )
    .map((member) => ({ id: member.id, name: member.name }));
}
