import type { NextRequest } from "next/server";
import { paymentListQuerySchema } from "@/lib/validation/payment-query-schema";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";
import { toCsv } from "@/lib/csv/to-csv";
import { PAYMENT_STATUS_LABELS } from "@/lib/crm/labels";

/**
 * Step 54 — CSV export for the Payments list, respecting the screen's own
 * active filters. Mirrors GET /api/payments's where-clause exactly, minus
 * pagination.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = paymentListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, dateFrom, dateTo } = parsed.data;

  const where = {
    ...(status ? { status } : {}),
    ...(!isServiceScopeUnrestricted(auth.session) ? { booking: { lead: serviceTypeCondition(auth.session) } } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { gatewayRef: { contains: search, mode: "insensitive" as const } },
            { booking: { bookingId: { contains: search, mode: "insensitive" as const } } },
            { booking: { customer: { name: { contains: search, mode: "insensitive" as const } } } },
            { booking: { customer: { mobile: { contains: search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const payments = await db.payment.findMany({
    where,
    include: { booking: { include: { customer: true, lead: true } } },
    orderBy: { createdAt: "desc" },
  });

  const csv = toCsv(payments, [
    { key: "bookingId", header: "Booking ID", value: (row) => row.booking.bookingId },
    { key: "leadReferenceId", header: "Lead Reference", value: (row) => formatLeadReference(row.booking.lead.serviceType, row.booking.leadId) },
    { key: "customerName", header: "Customer Name", value: (row) => row.booking.customer.name },
    { key: "customerMobile", header: "Customer Mobile", value: (row) => row.booking.customer.mobile },
    { key: "amount", header: "Base", value: (row) => Number(row.amount) },
    { key: "gstAmount", header: "GST", value: (row) => Number(row.gstAmount) },
    { key: "gatewayFee", header: "Gateway Fee", value: (row) => Number(row.gatewayFee) },
    { key: "status", header: "Status", value: (row) => PAYMENT_STATUS_LABELS[row.status] },
    { key: "gatewayRef", header: "Gateway Ref", value: (row) => row.gatewayRef ?? "" },
    { key: "createdAt", header: "Created At", value: (row) => row.createdAt.toISOString() },
  ]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
