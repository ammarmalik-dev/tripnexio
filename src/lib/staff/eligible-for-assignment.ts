import { db } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";

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
 * possible assignment factors, but the roadmap for this step scoped this
 * narrower (PAX-workload + leave only) — no service-specialization concept
 * exists anywhere in this schema to match against, so none is invented
 * here; every staff member who can work leads at all is equally eligible
 * for every service type today.
 */
export async function getEligibleStaffForAssignment(): Promise<EligibleStaffMember[]> {
  const staff = await db.user.findMany({
    where: { active: true },
    include: { role: { include: { permissions: true } } },
  });

  return staff
    .filter((member) => hasPermission({ permissions: member.role.permissions.map((permission) => permission.name) }, "leads.edit"))
    .map((member) => ({ id: member.id, name: member.name }));
}
