import type { Prisma } from "../../generated/prisma/client";
import { isServiceScopeUnrestricted, serviceTypeCondition } from "../auth/service-scope";
import type { StaffSession } from "../auth/staff-session";
import type { BookingListQueryValues } from "../validation/booking-query-schema";

/**
 * The Bookings list's where clause, shared by GET /api/bookings and its CSV
 * export. Client corrections 2026-10-05: a booking whose payment hasn't
 * succeeded (status PENDING) or failed stays with its Lead, so the Bookings
 * list never shows PENDING bookings. Lead-level facts (POC, country, travel
 * date) filter through the booking's lead.
 */
export function bookingListWhere(session: StaffSession, query: BookingListQueryValues): Prisma.BookingWhereInput {
  const { status, serviceType, search, dateFrom, dateTo, assignedStaffId, countryId, travelFrom, travelTo, paymentStatus, vendorId, serviceStatusId } =
    query;

  const statuses = (status ?? []).filter((value) => value !== "PENDING");
  const lead: Prisma.LeadWhereInput = {
    ...(serviceType || !isServiceScopeUnrestricted(session) ? serviceTypeCondition(session, serviceType) : {}),
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
    ...(vendorId ? { quotations: { some: { isSelected: true, vendorId } } } : {}),
  };

  return {
    status: statuses.length > 0 ? { in: statuses } : { not: "PENDING" },
    ...(Object.keys(lead).length > 0 ? { lead } : {}),
    ...(serviceStatusId ? { serviceStatusId } : {}),
    ...(paymentStatus ? { payments: { some: { status: paymentStatus } } } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { bookingId: { contains: search, mode: "insensitive" as const } },
            { customer: { name: { contains: search, mode: "insensitive" as const } } },
            { customer: { mobile: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}
