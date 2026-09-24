import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";
import { getStaffIdsOnApprovedLeave, isRosterEligible } from "@/lib/staff/eligible-for-assignment";
import type { ServiceType } from "@/generated/prisma/enums";

const SERVICE_TYPES: ServiceType[] = ["NEW_VISA", "VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE", "RETURN_TICKET", "OTB"];

/**
 * Step 39: optional `?service=` mirrors GET /api/vendors's own pattern.
 *
 * Step 50 — with `?service=` given, this is the lead-assignment roster
 * picker specifically (the only caller that passes it —
 * `LeadAssignmentControl`), so it applies the exact same "roster" rule
 * `getEligibleStaffForAssignment` uses for auto-suggestion: active, has
 * leads.edit/admin.full, scoped for the service, and not on approved
 * leave. Every other caller (Task assignment, Admin's staff-leave picker)
 * omits `service` and keeps the original full active-staff list unchanged
 * — those need to see staff without leads.edit too (e.g. a documents-only
 * staff member).
 *
 * `includeInactive=1` (only honored for a `leads.reassign`/`admin.full`
 * session, ignored otherwise) additionally drops the active-only filter —
 * `BulkReassignmentManager`'s "from" picker needs this: an admin moving
 * work off an employee who has since been deactivated must still be able
 * to find that employee to select them as the source.
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service");
  if (service && !SERVICE_TYPES.includes(service as ServiceType)) {
    return jsonError(400, "Invalid service query parameter.");
  }
  const includeInactive = searchParams.get("includeInactive") === "1" && hasPermission(session, "leads.reassign");

  const staff = await db.user.findMany({
    where: includeInactive ? {} : { active: true },
    include: { role: { include: { permissions: true } } },
    orderBy: { name: "asc" },
  });

  let filtered = staff;
  if (service) {
    const staffIdsOnLeave = await getStaffIdsOnApprovedLeave();
    filtered = staff.filter((member) => !staffIdsOnLeave.has(member.id) && isRosterEligible(member, service as ServiceType));
  }

  return jsonSuccess(
    filtered.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role.name,
      active: member.active,
    }))
  );
}
