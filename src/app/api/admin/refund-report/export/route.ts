import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { toCsv } from "@/lib/csv/to-csv";
import { SERVICE_TYPE_LABELS, REFUND_STATUS_LABELS } from "@/lib/crm/labels";
import { formatLeadReference } from "@/lib/leads/reference";

/** Business Rules §15 "Finance Reports + MIS" item 8 — CSV export of the Refund Report, same permission convention as every other bulk export (data.export, distinct from finance.manage's view-only aggregate). */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("data.export");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return jsonError(400, "Provide both a from and to date.");
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const toDateEndOfDay = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);

  const refunds = await db.refund.findMany({
    where: { createdAt: { gte: fromDate, lte: toDateEndOfDay } },
    include: { payment: { include: { booking: { include: { lead: true, customer: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  const csv = toCsv(refunds, [
    { key: "bookingId", header: "Booking ID", value: (row) => row.payment.booking.bookingId },
    { key: "leadReference", header: "Lead Reference", value: (row) => formatLeadReference(row.payment.booking.lead.serviceType, row.payment.booking.leadId) },
    { key: "customerName", header: "Customer Name", value: (row) => row.payment.booking.customer.name },
    { key: "serviceType", header: "Service", value: (row) => SERVICE_TYPE_LABELS[row.payment.booking.lead.serviceType] },
    { key: "status", header: "Status", value: (row) => REFUND_STATUS_LABELS[row.status] },
    { key: "paidAmount", header: "Paid Amount", value: (row) => row.paidAmount.toString() },
    { key: "cancellationCharge", header: "Cancellation Charge", value: (row) => row.cancellationCharge.toString() },
    { key: "gatewayCharge", header: "Gateway Charge", value: (row) => row.gatewayCharge.toString() },
    { key: "refundAmount", header: "Refund Amount", value: (row) => row.refundAmount.toString() },
    { key: "reason", header: "Reason", value: (row) => row.reason ?? "" },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="refund-report-${from}-to-${to}.csv"`,
    },
  });
}
