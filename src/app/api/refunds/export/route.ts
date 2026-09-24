import type { NextRequest } from "next/server";
import { refundListQuerySchema } from "@/lib/validation/refund-query-schema";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";
import { toCsv } from "@/lib/csv/to-csv";
import { REFUND_STATUS_LABELS } from "@/lib/crm/labels";

/**
 * Step 54 — CSV export for the Refunds list, respecting the screen's own
 * active filters. Mirrors GET /api/refunds's where-clause exactly, minus
 * pagination.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("refunds.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = refundListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, dateFrom, dateTo } = parsed.data;

  const where = {
    ...(status ? { status } : {}),
    ...(!isServiceScopeUnrestricted(auth.session)
      ? { payment: { booking: { lead: serviceTypeCondition(auth.session) } } }
      : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { payment: { booking: { bookingId: { contains: search, mode: "insensitive" as const } } } },
            { payment: { booking: { customer: { name: { contains: search, mode: "insensitive" as const } } } } },
            { payment: { booking: { customer: { mobile: { contains: search, mode: "insensitive" as const } } } } },
          ],
        }
      : {}),
  };

  const refunds = await db.refund.findMany({
    where,
    include: { payment: { include: { booking: { include: { customer: true, lead: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(refunds, [
    { key: "bookingId", header: "Booking ID", value: (row) => row.payment.booking.bookingId },
    { key: "leadReferenceId", header: "Lead Reference", value: (row) => formatLeadReference(row.payment.booking.lead.serviceType, row.payment.booking.leadId) },
    { key: "customerName", header: "Customer Name", value: (row) => row.payment.booking.customer.name },
    { key: "customerMobile", header: "Customer Mobile", value: (row) => row.payment.booking.customer.mobile },
    { key: "paidAmount", header: "Paid", value: (row) => Number(row.paidAmount) },
    { key: "cancellationCharge", header: "Cancellation Charge", value: (row) => Number(row.cancellationCharge) },
    { key: "gatewayCharge", header: "Gateway Charge", value: (row) => Number(row.gatewayCharge) },
    { key: "refundAmount", header: "Refund Amount", value: (row) => Number(row.refundAmount) },
    { key: "reason", header: "Reason", value: (row) => row.reason ?? "" },
    { key: "status", header: "Status", value: (row) => REFUND_STATUS_LABELS[row.status] },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="refunds-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
