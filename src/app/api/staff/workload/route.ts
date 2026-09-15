import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { getStaffWorkloads } from "@/lib/staff/workload";

/**
 * Step 26 Unit 1 (audit §3.11/§4.7) — PAX-based workload per active staff
 * member, per ADMIN.md §13's locked rule. Session-only (no specific
 * permission), matching GET /api/staff's own low-sensitivity reference-data
 * gating — this is aggregate team-load visibility, not per-customer data.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const staff = await db.user.findMany({ where: { active: true }, select: { id: true, name: true } });
  const workloads = await getStaffWorkloads(staff.map((member) => member.id));

  return jsonSuccess(
    staff.map((member) => {
      const workload = workloads.get(member.id)!;
      return { staffId: member.id, name: member.name, openBookingCount: workload.openBookingCount, paxCount: workload.paxCount };
    })
  );
}
