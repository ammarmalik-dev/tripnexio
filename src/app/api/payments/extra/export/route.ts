import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { toCsv } from "@/lib/csv/to-csv";
import { formatLeadReference } from "@/lib/leads/reference";

/**
 * Step 52 — the Extra Payment report's CSV export. Gated by `payments.view`
 * (the same permission the report itself needs), not the Admin-only
 * `data.export` — this is a narrow, single-transaction-type export, not
 * the bulk customer-data export `data.export` is reserved for (a
 * deliberate judgment call, not an oversight).
 */
export async function GET() {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const payments = await db.payment.findMany({
    where: {
      purpose: "EXTRA",
      ...(!isServiceScopeUnrestricted(auth.session) ? { booking: { lead: serviceTypeCondition(auth.session) } } : {}),
    },
    include: { booking: { include: { customer: true, lead: true } } },
    orderBy: { createdAt: "asc" },
  });

  const csv = toCsv(payments, [
    { key: "bookingId", header: "Booking ID", value: (row) => row.booking.bookingId },
    { key: "leadReference", header: "Lead Reference", value: (row) => formatLeadReference(row.booking.lead.serviceType, row.booking.leadId) },
    { key: "customerName", header: "Customer Name", value: (row) => row.booking.customer.name },
    { key: "customerMobile", header: "Customer Mobile", value: (row) => row.booking.customer.mobile },
    { key: "amount", header: "Amount", value: (row) => Number(row.amount) },
    { key: "gstAmount", header: "GST", value: (row) => Number(row.gstAmount) },
    { key: "gatewayFee", header: "Gateway Fee", value: (row) => Number(row.gatewayFee) },
    { key: "description", header: "Reason", value: (row) => row.description ?? "" },
    { key: "status", header: "Status", value: (row) => row.status },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="extra-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
