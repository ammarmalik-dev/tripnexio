import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { getStaffSession } from "@/lib/auth/staff-session";
import { getEligibleStaffForAssignment } from "@/lib/staff/eligible-for-assignment";
import { getStaffWorkloads } from "@/lib/staff/workload";
import type { ServiceType } from "@/generated/prisma/enums";

const SERVICE_TYPES: ServiceType[] = ["NEW_VISA", "VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE", "RETURN_TICKET", "OTB"];

/**
 * Step 26 Unit 2 (audit §3.11/§4.7) — ADMIN.md §13's rule applied as a
 * suggestion, not a direct assignment (confirmed this scope explicitly
 * before building it — a full-auto version would silently make a
 * customer-facing staffing decision with no review step). Ties in with
 * Lead.assignedStaffId being the sole ownership pointer (see
 * getStaffWorkloads' own doc comment) — this suggests who a NEW,
 * currently-unassigned lead should go to, based on everyone else's
 * EXISTING open-booking PAX load; it doesn't (and can't, since a brand-new
 * lead usually has no finalized passenger list yet) try to weigh the new
 * lead's own future PAX into the comparison.
 *
 * Session-only, matching GET /api/staff — this doesn't reveal anything a
 * signed-in staff member couldn't already piece together from the Leads
 * list plus GET /api/staff/workload.
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const service = new URL(request.url).searchParams.get("service");
  if (service && !SERVICE_TYPES.includes(service as ServiceType)) {
    return jsonError(400, "Invalid service query parameter.");
  }

  const eligibleStaff = await getEligibleStaffForAssignment(service ? (service as ServiceType) : undefined);
  if (eligibleStaff.length === 0) {
    return jsonSuccess({ suggestion: null });
  }

  const workloads = await getStaffWorkloads(eligibleStaff.map((member) => member.id));

  let leastLoaded = eligibleStaff[0];
  let leastLoadedWorkload = workloads.get(leastLoaded.id)!;
  for (const candidate of eligibleStaff.slice(1)) {
    const candidateWorkload = workloads.get(candidate.id)!;
    if (candidateWorkload.paxCount < leastLoadedWorkload.paxCount) {
      leastLoaded = candidate;
      leastLoadedWorkload = candidateWorkload;
    }
  }

  return jsonSuccess({
    suggestion: {
      staffId: leastLoaded.id,
      name: leastLoaded.name,
      paxCount: leastLoadedWorkload.paxCount,
      openBookingCount: leastLoadedWorkload.openBookingCount,
    },
  });
}
