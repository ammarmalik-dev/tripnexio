import { leadOwnershipWhere } from "../auth/ownership";
import type { Prisma } from "../../generated/prisma/client";
import { serviceTypeCondition } from "../auth/service-scope";
import type { StaffSession } from "../auth/staff-session";
import type { LeadListQueryValues } from "../validation/lead-query-schema";
import { AWAITING_QUOTATION_WHERE } from "../quotations/awaiting";

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
  // Client testing 2026-10-09 (E7) — staff see their own + unassigned leads.
  const ownership = leadOwnershipWhere(session);
  const base: Prisma.LeadWhereInput = {
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
    // Client doc 2026-10-15 (C1) — one search box finds a lead by its number (e.g. 11026VE040), booking ID,
    // customer name, mobile or email, the moment it is created (website, WhatsApp or staff).
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" as const } },
            { bookings: { some: { bookingId: { contains: search, mode: "insensitive" as const } } } },
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
            { customer: { mobile: { contains: search.replace(/[\s-]/g, ""), mode: "insensitive" as const } } },
            { customer: { email: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...extra,
  };
  // Dashboard doc §7 — a full-form Special Fare / Visa Extension / Visa Change request waits in Quotations →
  // Awaiting quotation, not in Leads; it comes back here once quoted. A search still finds it.
  const conditions = [base, ...(Object.keys(ownership).length > 0 ? [ownership] : []), ...(search ? [] : [{ NOT: AWAITING_QUOTATION_WHERE }])];
  return conditions.length === 1 ? base : { AND: conditions };
}
