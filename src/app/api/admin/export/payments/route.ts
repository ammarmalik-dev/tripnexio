import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { csvExportResponse, EXPORT_QUERY_TAKE } from "@/lib/csv/export-guard";
import { PAYMENT_STATUS_LABELS } from "@/lib/crm/labels";

export async function GET() {
  const auth = await requirePermission("data.export");
  if (auth.error) return auth.error;

  const payments = await db.payment.findMany({ take: EXPORT_QUERY_TAKE, include: { booking: { include: { customer: true } } }, orderBy: { createdAt: "asc" } });

  return csvExportResponse({
    exportName: "admin-payments",
    filename: `payments-${new Date().toISOString().slice(0, 10)}.csv`,
    rows: payments,
    byUserId: auth.session.id,
    filters: {},
    columns: [
      { key: "bookingId", header: "Booking ID", value: (row) => row.booking.bookingId },
      { key: "customerName", header: "Customer Name", value: (row) => row.booking.customer.name },
      { key: "amount", header: "Base Amount", value: (row) => row.amount.toString() },
      { key: "gstAmount", header: "GST", value: (row) => row.gstAmount.toString() },
      { key: "gatewayFee", header: "Gateway Fee", value: (row) => row.gatewayFee.toString() },
      { key: "status", header: "Status", value: (row) => PAYMENT_STATUS_LABELS[row.status] },
      { key: "gatewayRef", header: "Gateway Ref", value: (row) => row.gatewayRef ?? "" },
      { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
    ],
  });
}
