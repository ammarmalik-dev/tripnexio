import type { NextRequest } from "next/server";
import { createBookingSchema } from "@/lib/validation/booking-schema";
import { createBookingFromQuotation } from "@/lib/bookings/create-booking";
import { bookingListQuerySchema } from "@/lib/validation/booking-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { syncExpiredReservations } from "@/lib/bookings/reservation";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess, serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = bookingListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, sort, page, pageSize } = parsed.data;

  const where = {
    ...(status ? { status } : {}),
    ...(!isServiceScopeUnrestricted(auth.session) ? { lead: serviceTypeCondition(auth.session) } : {}),
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

  const [total, bookingsRaw] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      include: {
        customer: true,
        lead: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
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

  const items = bookings.map((booking) => ({
    id: booking.id,
    bookingId: booking.bookingId,
    status: booking.status,
    createdAt: booking.createdAt,
    serviceType: booking.lead.serviceType,
    leadId: booking.leadId,
    leadReferenceId: formatLeadReference(booking.lead.serviceType, booking.leadId),
    customer: { name: booking.customer.name, mobile: booking.customer.mobile },
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
