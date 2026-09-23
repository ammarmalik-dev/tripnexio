import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasServiceAccess } from "@/lib/auth/service-scope";
import type { ServiceType } from "@/generated/prisma/enums";

const SERVICE_TYPES: ServiceType[] = ["NEW_VISA", "VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE", "RETURN_TICKET", "OTB"];

/**
 * Step 39: optional `?service=` mirrors GET /api/vendors's own pattern —
 * filters to staff scoped for that service (or unrestricted). Every
 * existing caller that omits it keeps getting the full active staff list,
 * unchanged.
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const service = new URL(request.url).searchParams.get("service");
  if (service && !SERVICE_TYPES.includes(service as ServiceType)) {
    return jsonError(400, "Invalid service query parameter.");
  }

  const staff = await db.user.findMany({
    where: { active: true },
    include: { role: { include: { permissions: true } } },
    orderBy: { name: "asc" },
  });

  const filtered = service
    ? staff.filter((member) =>
        hasServiceAccess(
          { permissions: member.role.permissions.map((p) => p.name), allowedServiceTypes: member.allowedServiceTypes },
          service as ServiceType
        )
      )
    : staff;

  return jsonSuccess(
    filtered.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role.name,
    }))
  );
}
