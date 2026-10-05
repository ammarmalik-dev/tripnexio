import type { Prisma } from "../../generated/prisma/client";
import { serviceTypeCondition } from "../auth/service-scope";
import type { StaffSession } from "../auth/staff-session";
import type { LeadListQueryValues } from "../validation/lead-query-schema";

/**
 * The Leads list's where clause, shared by GET /api/leads and its CSV export
 * so "what you see is what you export". `extra` carries conditions only the
 * list computes (e.g. the payment-failed id set).
 */
export function leadListWhere(
  session: StaffSession,
  query: LeadListQueryValues,
  extra: Prisma.LeadWhereInput = {}
): Prisma.LeadWhereInput {
  const { serviceType, status, temperature, search, dateFrom, dateTo, assignedStaffId, countryId, travelFrom, travelTo } = query;
  return {
    ...serviceTypeCondition(session, serviceType),
    ...(status ? { status } : {}),
    ...(temperature ? { temperature } : {}),
    ...(assignedStaffId ? { assignedStaffId: assignedStaffId === "unassigned" ? null : assignedStaffId } : {}),
    ...(countryId ? { countryId } : {}),
    ...(travelFrom || travelTo
      ? {
          travelDate: {
            ...(travelFrom ? { gte: new Date(`${travelFrom}T00:00:00Z`) } : {}),
            ...(travelTo ? { lte: new Date(`${travelTo}T00:00:00Z`) } : {}),
          },
        }
      : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(search
      ? {
          customer: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { mobile: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
    ...extra,
  };
}
