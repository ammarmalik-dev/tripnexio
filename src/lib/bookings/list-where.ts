import { leadOwnershipWhere } from "../auth/ownership";
import type { Prisma } from "../../generated/prisma/client";
import { isServiceScopeUnrestricted, serviceTypeCondition } from "../auth/service-scope";
import type { StaffSession } from "../auth/staff-session";
import { DERIVED_BOOKING_FILTERS, type BookingListQueryValues } from "../validation/booking-query-schema";
import type { BookingStatus } from "../../generated/prisma/enums";

/**
 * The Bookings list's where clause, shared by GET /api/bookings and its CSV
 * export. Client corrections 2026-10-05: a booking whose payment hasn't
 * succeeded (status PENDING) or failed stays with its Lead, so the Bookings
 * list never shows PENDING bookings. Lead-level facts (POC, country, travel
 * date) filter through the booking's lead.
 */
export function bookingListWhere(session: StaffSession, query: BookingListQueryValues): Prisma.BookingWhereInput {
  const { status, serviceType, search, dateFrom, dateTo, assignedStaffId, countryId, travelFrom, travelTo, paymentStatus, vendorId, serviceStatusId, customerStatus } =
    query;

  const picked = status ?? [];
  const statuses = picked.filter((value): value is BookingStatus => value !== "PENDING" && !(DERIVED_BOOKING_FILTERS as readonly string[]).includes(value));
  // Client doc 2026-10-20 (N1 / N2) — Partial Approved: some passengers approved, others still in process;
  // Partial Refund: a completed refund on a booking that isn't fully refunded (its passengers show Cancelled).
  const derived: Prisma.BookingWhereInput[] = [
    ...(picked.includes("PARTIAL_APPROVED")
      ? [{ status: { in: ["CONFIRMED", "PROCESSING"] as BookingStatus[] }, AND: [{ passengers: { some: { outcome: "APPROVED" as const } } }, { passengers: { some: { outcome: null } } }] }]
      : []),
    ...(picked.includes("PARTIAL_REFUND")
      ? [{ status: { notIn: ["PENDING", "REFUNDED"] as BookingStatus[] }, payments: { some: { refunds: { some: { status: "COMPLETED" as const } } } } }]
      : []),
  ];
  const statusWhere: Prisma.BookingWhereInput =
    derived.length === 0
      ? { status: statuses.length > 0 ? { in: statuses } : { not: "PENDING" } }
      : { AND: [{ OR: [...(statuses.length > 0 ? [{ status: { in: statuses } }] : []), ...derived] }] }; // AND, so the search's own OR still applies
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
    // Client testing 2026-10-09 (E7) — staff see bookings of their own + unassigned leads.
    ...leadOwnershipWhere(session),
  };

  return {
    ...statusWhere,
    ...(Object.keys(lead).length > 0 ? { lead } : {}),
    ...(serviceStatusId ? { serviceStatusId } : customerStatus ? { serviceStatus: { customerLabel: customerStatus } } : {}),
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
            // Client testing 2026-10-09 (E13) — passport number and email too.
            { customer: { email: { contains: search, mode: "insensitive" as const } } },
            { passengers: { some: { passenger: { passportNumber: { contains: search, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  };
}
