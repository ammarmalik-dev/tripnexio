import { leadOwnershipWhere } from "../auth/ownership";
import type { Prisma } from "../../generated/prisma/client";
import { serviceTypeCondition } from "../auth/service-scope";
import type { StaffSession } from "../auth/staff-session";
import type { LeadListQueryValues } from "../validation/lead-query-schema";
import { entrySourceWhere } from "./entry-source";
import { ABANDONED_DRAFT_SOURCE } from "./abandoned-draft";

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
    ...entrySourceWhere(query.entrySource),
    ...(status ? { status } : {}),
    ...(temperature ? { temperature } : {}),
    ...(assignedStaffId ? { assignedStaffId: assignedStaffId === "unassigned" ? null : assignedStaffId } : {}),
    ...(countryId ? { countryId } : {}),
    ...(query.salesStage === "UNPAID" ? { status: { in: ["QUOTATION_ACCEPTED", "PAYMENT_PENDING"] as ("QUOTATION_ACCEPTED" | "PAYMENT_PENDING")[] } } : {}),
    ...(query.salesStage === "PAID" ? { bookings: { some: { payments: { some: { status: "SUCCESS" as const } } } } } : {}),
    ...(query.salesStage === "ABANDONED" ? { source: ABANDONED_DRAFT_SOURCE } : {}),
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
  // Client doc 2026-10-27 (A1) — a Special Fare / Visa Extension / Visa Change request still waiting for its
  // quotation is listed here too (marked "Awaiting quotation"), not only under Quotations → Awaiting quotation.
  // Client doc 16 Nov (J1 / J8) — due follow-ups: not responding, or the follow-up date reached; open leads only.
  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  const followUp: Prisma.LeadWhereInput | null = query.followUpDue
    ? { status: { notIn: ["CONVERTED", "LOST", "CLOSED"] }, OR: [{ status: "FOLLOW_UP_REQUIRED" }, { nextFollowUpAt: { lte: endOfToday } }] }
    : null;
  const conditions = [base, ...(Object.keys(ownership).length > 0 ? [ownership] : []), ...(followUp ? [followUp] : [])];
  return conditions.length === 1 ? base : { AND: conditions };
}
