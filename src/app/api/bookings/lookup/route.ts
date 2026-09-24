import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { formatLeadReference, parseLeadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";

/**
 * Step 52 (Internal Dashboard Merged §9) — "staff search by Booking ID or
 * Lead reference, the system auto-fetches customer/booking details." A
 * dedicated single-result resolver for the Extra Payment Collection
 * screen — distinct from the multi-result Global Search (Step 24), which
 * returns lightweight `{title, subtitle, href}` rows, not the full detail
 * this screen needs in one round trip.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  const query = (new URL(request.url).searchParams.get("query") ?? "").trim();
  if (!query) return jsonError(400, "Provide a Booking ID or Lead reference.");

  const bookingByExactId = await db.booking.findFirst({
    where: { bookingId: { equals: query, mode: "insensitive" } },
    include: { customer: true, lead: true },
  });

  let booking = bookingByExactId;
  if (!booking) {
    const parsedReference = parseLeadReference(query);
    if (parsedReference) {
      booking = await db.booking.findFirst({
        where: { lead: { serviceType: parsedReference.serviceType, id: { endsWith: parsedReference.suffix } } },
        include: { customer: true, lead: true },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  if (!booking) {
    return jsonError(404, "No booking found for that Booking ID or Lead reference.");
  }

  const scopeError = assertServiceAccess(auth.session, booking.lead.serviceType);
  if (scopeError) return scopeError;

  return jsonSuccess({
    id: booking.id,
    bookingId: booking.bookingId,
    status: booking.status,
    serviceType: booking.lead.serviceType,
    serviceTypeLabel: SERVICE_TYPE_LABELS[booking.lead.serviceType],
    leadId: booking.leadId,
    leadReferenceId: formatLeadReference(booking.lead.serviceType, booking.leadId),
    customer: { name: booking.customer.name, mobile: booking.customer.mobile, email: booking.customer.email },
  });
}
