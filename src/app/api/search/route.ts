import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";
import { formatLeadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { ServiceType } from "@/generated/prisma/enums";

/** Reverse of SERVICE_REFERENCE_PREFIX in src/lib/leads/reference.ts. */
const REFERENCE_PREFIX_TO_SERVICE: Record<string, ServiceType> = {
  NV: "NEW_VISA",
  VE: "VISA_EXTENSION",
  VC: "VISA_CHANGE",
  FF: "FLIGHT_SPECIAL_FARE",
  RT: "RETURN_TICKET",
  OTB: "OTB",
};

interface SearchResultItem {
  type: "lead" | "booking";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const RESULT_LIMIT_PER_QUERY_DIMENSION = 5;
const TOTAL_RESULT_LIMIT = 10;

/**
 * Step 24 (audit §4.6) — ADMIN.md §9's "global search/command experience,"
 * started narrow per the roadmap prompt's own scoping: Lead reference,
 * Booking ID, and customer name/mobile (3 of ADMIN.md §9's 7 example
 * fields — PAX/service/vendor/refund search are explicitly deferred, not
 * forgotten).
 *
 * Judgment call: ADMIN.md §9 lists "Search customer" as its own example,
 * but this app has no standalone Customer detail page to link a bare
 * customer match to — `/crm/customers` is still a placeholder (Phase 3A).
 * So a customer name/mobile match surfaces as Lead and/or Booking results
 * belonging to that customer (the same convention GET /api/leads's own
 * `search` param already uses for name/mobile), rather than a third,
 * unlinkable result type. Every result in the unified list always has a
 * real detail page to open.
 *
 * Each of the three query dimensions is gated by the same permission the
 * underlying entity's own list/detail routes require (leads.view /
 * bookings.view) — a limited-role user never sees a search result for
 * something their own dashboard couldn't show them either.
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return jsonSuccess({ query, results: [] });
  }

  const canViewLeads = hasPermission(session, "leads.view");
  const canViewBookings = hasPermission(session, "bookings.view");

  const leadResults = new Map<string, SearchResultItem>();
  const bookingResults = new Map<string, SearchResultItem>();

  // --- Lead reference, e.g. "NV-058517" — the exact format shown
  // everywhere a lead reference is displayed (LeadsTable, BookingDetail's
  // "leadReferenceId" link, etc.), not a stored column — reverse-derived
  // the same way formatLeadReference() forward-derives it. ---
  const referenceMatch = /^([A-Za-z]+)-([A-Za-z0-9]+)$/.exec(query);
  if (canViewLeads && referenceMatch) {
    const serviceType = REFERENCE_PREFIX_TO_SERVICE[referenceMatch[1].toUpperCase()];
    if (serviceType) {
      const leads = await db.lead.findMany({
        where: { serviceType, id: { endsWith: referenceMatch[2].toLowerCase() } },
        include: { customer: true },
        take: RESULT_LIMIT_PER_QUERY_DIMENSION,
      });
      for (const lead of leads) {
        leadResults.set(lead.id, {
          type: "lead",
          id: lead.id,
          title: formatLeadReference(lead.serviceType, lead.id),
          subtitle: `${lead.customer.name} · ${SERVICE_TYPE_LABELS[lead.serviceType]}`,
          href: `/crm/leads/${lead.id}`,
        });
      }
    }
  }

  // --- Booking ID, e.g. "TNX-OT-058517" (or a still-pending "PENDING-..."
  // placeholder — see Booking.bookingId's own doc comment) — a real stored
  // column, plain substring match. ---
  if (canViewBookings) {
    const bookings = await db.booking.findMany({
      where: { bookingId: { contains: query, mode: "insensitive" } },
      include: { customer: true, lead: true },
      take: RESULT_LIMIT_PER_QUERY_DIMENSION,
    });
    for (const booking of bookings) {
      bookingResults.set(booking.id, {
        type: "booking",
        id: booking.id,
        title: booking.bookingId,
        subtitle: `${booking.customer.name} · ${SERVICE_TYPE_LABELS[booking.lead.serviceType]}`,
        href: `/crm/bookings/${booking.id}`,
      });
    }
  }

  // --- Customer name/mobile — see this function's own doc comment for why
  // this surfaces as Lead/Booking results rather than a third type. ---
  const matchingCustomers = await db.customer.findMany({
    where: {
      OR: [{ name: { contains: query, mode: "insensitive" } }, { mobile: { contains: query, mode: "insensitive" } }],
    },
    select: { id: true },
    take: RESULT_LIMIT_PER_QUERY_DIMENSION,
  });
  const customerIds = matchingCustomers.map((customer) => customer.id);

  if (customerIds.length > 0) {
    if (canViewLeads) {
      const leads = await db.lead.findMany({
        where: { customerId: { in: customerIds } },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: RESULT_LIMIT_PER_QUERY_DIMENSION,
      });
      for (const lead of leads) {
        leadResults.set(lead.id, {
          type: "lead",
          id: lead.id,
          title: formatLeadReference(lead.serviceType, lead.id),
          subtitle: `${lead.customer.name} · ${lead.customer.mobile}`,
          href: `/crm/leads/${lead.id}`,
        });
      }
    }
    if (canViewBookings) {
      const bookings = await db.booking.findMany({
        where: { customerId: { in: customerIds } },
        include: { customer: true, lead: true },
        orderBy: { createdAt: "desc" },
        take: RESULT_LIMIT_PER_QUERY_DIMENSION,
      });
      for (const booking of bookings) {
        bookingResults.set(booking.id, {
          type: "booking",
          id: booking.id,
          title: booking.bookingId,
          subtitle: `${booking.customer.name} · ${booking.customer.mobile}`,
          href: `/crm/bookings/${booking.id}`,
        });
      }
    }
  }

  const results = [...leadResults.values(), ...bookingResults.values()].slice(0, TOTAL_RESULT_LIMIT);
  return jsonSuccess({ query, results });
}
