import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";
import { leadReference, parseLeadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";

interface SearchResultItem {
  type: "customer" | "lead" | "booking";
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

  // --- Lead reference: the stored Lead.reference, new format
  // ("10626VI001") or older ("NV-058517"), substring match. A legacy
  // "PREFIX-SUFFIX" query also matches by id suffix, for any lead that
  // predates stored references. ---
  const parsedReference = parseLeadReference(query);
  if (canViewLeads) {
    const leads = await db.lead.findMany({
      where: {
        OR: [
          { reference: { contains: query, mode: "insensitive" } },
          ...(parsedReference ? [{ serviceType: parsedReference.serviceType, id: { endsWith: parsedReference.suffix } }] : []),
        ],
      },
      include: { customer: true },
      take: RESULT_LIMIT_PER_QUERY_DIMENSION,
    });
    for (const lead of leads) {
      leadResults.set(lead.id, {
        type: "lead",
        id: lead.id,
        title: leadReference(lead),
        subtitle: `${lead.customer.name} · ${SERVICE_TYPE_LABELS[lead.serviceType]}`,
        href: `/crm/leads/${lead.id}`,
      });
    }
  }

  // --- Booking ID — the lead's reference (e.g. "10626VI001") or an older
  // "TNX-OT-058517" — a stored column, plain substring match. ---
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

  // --- Client corrections 2026-10-05: one global 360 search. A customer
  // matched by name, mobile, email or any passenger's passport number is a
  // Customer result that opens the separate Customer 360 page (all their
  // leads, bookings, PAX, documents and payments); Lead ID / Booking ID
  // matches above open that record directly. Same permission as the
  // Customers screen (leads.view). ---
  const customerResults = new Map<string, SearchResultItem>();
  if (canViewLeads) {
    const customers = await db.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { mobile: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { passengers: { some: { passportNumber: { contains: query, mode: "insensitive" } } } },
        ],
      },
      select: { id: true, name: true, mobile: true, email: true },
      orderBy: { createdAt: "desc" },
      take: RESULT_LIMIT_PER_QUERY_DIMENSION,
    });
    for (const customer of customers) {
      customerResults.set(customer.id, {
        type: "customer",
        id: customer.id,
        title: customer.name,
        subtitle: [customer.mobile, customer.email].filter(Boolean).join(" · "),
        href: `/crm/customers/${customer.id}`,
      });
    }
  }

  const results = [...customerResults.values(), ...leadResults.values(), ...bookingResults.values()].slice(0, TOTAL_RESULT_LIMIT);
  return jsonSuccess({ query, results });
}
