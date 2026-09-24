import type { NextRequest } from "next/server";
import { bookingListQuerySchema } from "@/lib/validation/booking-query-schema";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";
import { toCsv } from "@/lib/csv/to-csv";
import { SERVICE_TYPE_LABELS, BOOKING_STATUS_LABELS } from "@/lib/crm/labels";

/**
 * Step 54 — CSV export for the Bookings list, respecting the screen's own
 * active filters. Mirrors GET /api/bookings's where-clause exactly, minus
 * pagination.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = bookingListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, dateFrom, dateTo } = parsed.data;

  const where = {
    ...(status ? { status: { in: status } } : {}),
    ...(!isServiceScopeUnrestricted(auth.session) ? { lead: serviceTypeCondition(auth.session) } : {}),
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

  const bookings = await db.booking.findMany({
    where,
    include: { customer: true, lead: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(bookings, [
    { key: "bookingId", header: "Booking ID", value: (row) => row.bookingId },
    { key: "leadReferenceId", header: "Lead Reference", value: (row) => formatLeadReference(row.lead.serviceType, row.leadId) },
    { key: "service", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.lead.serviceType] },
    { key: "status", header: "Status", value: (row) => BOOKING_STATUS_LABELS[row.status] },
    { key: "customerName", header: "Customer Name", value: (row) => row.customer.name },
    { key: "customerMobile", header: "Customer Mobile", value: (row) => row.customer.mobile },
    { key: "latestPaymentStatus", header: "Latest Payment Status", value: (row) => row.payments[0]?.status ?? "" },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
