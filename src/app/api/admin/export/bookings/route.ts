import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { toCsv } from "@/lib/csv/to-csv";
import { formatLeadReference } from "@/lib/leads/reference";
import { SERVICE_TYPE_LABELS, BOOKING_STATUS_LABELS } from "@/lib/crm/labels";

export async function GET() {
  const auth = await requirePermission("data.export");
  if (auth.error) return auth.error;

  const bookings = await db.booking.findMany({ include: { customer: true, lead: true }, orderBy: { createdAt: "asc" } });

  const csv = toCsv(bookings, [
    { key: "bookingId", header: "Booking ID", value: (row) => row.bookingId },
    { key: "leadReference", header: "Lead Reference", value: (row) => formatLeadReference(row.lead.serviceType, row.leadId) },
    { key: "service", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.lead.serviceType] },
    { key: "status", header: "Status", value: (row) => BOOKING_STATUS_LABELS[row.status] },
    { key: "customerName", header: "Customer Name", value: (row) => row.customer.name },
    { key: "customerMobile", header: "Customer Mobile", value: (row) => row.customer.mobile },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
