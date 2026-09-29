import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { csvExportResponse, EXPORT_QUERY_TAKE } from "@/lib/csv/export-guard";
import { leadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS, BOOKING_STATUS_LABELS } from "@/lib/crm/labels";

export async function GET() {
  const auth = await requirePermission("data.export");
  if (auth.error) return auth.error;

  const bookings = await db.booking.findMany({ take: EXPORT_QUERY_TAKE, include: { customer: true, lead: true }, orderBy: { createdAt: "asc" } });

  return csvExportResponse({
    exportName: "admin-bookings",
    filename: `bookings-${new Date().toISOString().slice(0, 10)}.csv`,
    rows: bookings,
    byUserId: auth.session.id,
    filters: {},
    columns: [
      { key: "bookingId", header: "Booking ID", value: (row) => row.bookingId },
      { key: "leadReference", header: "Lead Reference", value: (row) => leadReference(row.lead) },
      { key: "service", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.lead.serviceType] },
      { key: "status", header: "Status", value: (row) => BOOKING_STATUS_LABELS[row.status] },
      { key: "customerName", header: "Customer Name", value: (row) => row.customer.name },
      { key: "customerMobile", header: "Customer Mobile", value: (row) => row.customer.mobile },
      { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
    ],
  });
}
