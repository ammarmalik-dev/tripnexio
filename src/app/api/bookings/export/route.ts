import type { NextRequest } from "next/server";
import { bookingListQuerySchema } from "@/lib/validation/booking-query-schema";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { leadReference } from "@/lib/leads/reference";
import { bookingListWhere } from "@/lib/bookings/list-where";
import { csvExportResponse, EXPORT_QUERY_TAKE, exportFiltersFromSearchParams } from "@/lib/csv/export-guard";
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

  const where = bookingListWhere(auth.session, parsed.data);

  const bookings = await db.booking.findMany({
    take: EXPORT_QUERY_TAKE,
    where,
    include: {
      customer: true,
      lead: {
        include: {
          country: { select: { name: true } },
          assignedStaff: { select: { name: true } },
          quotations: { where: { isSelected: true }, take: 1, select: { vendor: { select: { name: true } } } },
        },
      },
      serviceStatus: { select: { name: true, customerLabel: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { passengers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return csvExportResponse({
    exportName: "bookings",
    filename: `bookings-${new Date().toISOString().slice(0, 10)}.csv`,
    rows: bookings,
    byUserId: auth.session.id,
    filters: exportFiltersFromSearchParams(searchParams),
    columns: [
      { key: "bookingId", header: "Booking ID", value: (row) => row.bookingId },
      { key: "leadReferenceId", header: "Lead Reference", value: (row) => leadReference(row.lead) },
      { key: "service", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.lead.serviceType] },
      { key: "status", header: "Status", value: (row) => BOOKING_STATUS_LABELS[row.status] },
      { key: "customerStatus", header: "Customer Status", value: (row) => row.serviceStatus?.customerLabel ?? "" },
      { key: "internalStatus", header: "Internal Status", value: (row) => row.serviceStatus?.name ?? "" },
      { key: "pax", header: "PAX", value: (row) => String(row._count.passengers || row.lead.paxCount || "") },
      { key: "country", header: "Country", value: (row) => row.lead.country?.name ?? "" },
      { key: "travelDate", header: "Travel Date", value: (row) => (row.lead.travelDate ? row.lead.travelDate.toISOString().slice(0, 10) : "") },
      { key: "poc", header: "POC", value: (row) => row.lead.assignedStaff?.name ?? "" },
      { key: "vendor", header: "Vendor", value: (row) => row.lead.quotations[0]?.vendor.name ?? "" },
      { key: "source", header: "Source", value: (row) => row.lead.source ?? "" },
      { key: "appliedAt", header: "Apply Date", value: (row) => row.appliedToEmbassyAt?.toISOString() ?? "" },
      { key: "customerName", header: "Customer Name", value: (row) => row.customer.name },
      { key: "customerMobile", header: "Customer Mobile", value: (row) => row.customer.mobile },
      { key: "latestPaymentStatus", header: "Latest Payment Status", value: (row) => row.payments[0]?.status ?? "" },
      { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
    ],
  });
}
