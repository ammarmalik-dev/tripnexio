import type { NextRequest } from "next/server";
import { createBookingSchema } from "@/lib/validation/booking-schema";
import { createBookingFromQuotation } from "@/lib/bookings/create-booking";
import { bookingListQuerySchema } from "@/lib/validation/booking-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { syncExpiredReservations } from "@/lib/bookings/reservation";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { isUrgentRequest } from "@/lib/crm/urgency";
import { bookingListWhere } from "@/lib/bookings/list-where";
import { subServiceLabel } from "@/lib/leads/sub-service-label";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = bookingListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { sort, page, pageSize } = parsed.data;
  const where = bookingListWhere(auth.session, parsed.data);

  const [total, bookingsRaw] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      include: {
        customer: true,
        lead: {
          include: {
            country: { select: { name: true } },
            assignedStaff: { select: { name: true, active: true } },
            quotations: { where: { isSelected: true }, take: 1, select: { vendor: { select: { name: true } } } },
          },
        },
        serviceStatus: { select: { name: true, customerLabel: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { passengers: true } },
      },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  // Return_Verified_Ticket.md §7's 24h reservation window is lazily synced
  // here too, not just on the detail route — see
  // feedback_audit_all_readers_of_lazily_synced_state in memory.
  const bookings = await syncExpiredReservations(bookingsRaw);

  // Client corrections 2026-10-05 — the full operational table.
  const items = bookings.map((booking) => ({
    id: booking.id,
    bookingId: booking.bookingId,
    status: booking.status,
    createdAt: booking.createdAt,
    serviceType: booking.lead.serviceType,
    subService: subServiceLabel(booking.lead.details),
    urgent: isUrgentRequest(booking.lead.serviceType, booking.lead.details),
    leadId: booking.leadId,
    leadReferenceId: leadReference(booking.lead),
    customer: { name: booking.customer.name, mobile: booking.customer.mobile },
    paxCount: booking._count.passengers || booking.lead.paxCount,
    countryName: booking.lead.country?.name ?? null,
    travelDate: booking.lead.travelDate ? booking.lead.travelDate.toISOString().slice(0, 10) : null,
    customerStatus: booking.serviceStatus?.customerLabel ?? null,
    internalStatus: booking.serviceStatus?.name ?? null,
    poc: booking.lead.assignedStaff ? { name: booking.lead.assignedStaff.name, active: booking.lead.assignedStaff.active } : null,
    vendorName: booking.lead.quotations[0]?.vendor.name ?? null,
    source: booking.lead.source,
    appliedAt: booking.appliedToEmbassyAt,
    latestPayment: booking.payments[0] ? { id: booking.payments[0].id, status: booking.payments[0].status } : null,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const quotation = await db.quotation.findUnique({ where: { id: parsed.data.quotationId }, include: { lead: true } });
  if (!quotation) return jsonError(404, "Quotation not found.");
  const scopeError = assertServiceAccess(session, quotation.lead.serviceType);
  if (scopeError) return scopeError;

  const result = await createBookingFromQuotation(parsed.data.quotationId, {
    byUserId: session.id,
    label: `by ${session.name}`,
  });
  if (!result.ok) {
    return jsonError(result.status, result.error, result.status === 409 ? { quotationId: [result.error] } : undefined);
  }

  return jsonSuccess(result.booking, 201);
}
