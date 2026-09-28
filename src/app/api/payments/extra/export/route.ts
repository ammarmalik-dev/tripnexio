import type { NextRequest } from "next/server";
import { extraPaymentListQuerySchema } from "@/lib/validation/extra-payment-query-schema";
import { jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { toCsv } from "@/lib/csv/to-csv";
import { leadReference } from "@/lib/leads/reference";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Step 52 — the Extra Payment report's CSV export. Gated by `payments.view`
 * (the same permission the report itself needs), not the Admin-only
 * `data.export` — this is a narrow, single-transaction-type export, not
 * the bulk customer-data export `data.export` is reserved for (a
 * deliberate judgment call, not an oversight).
 *
 * Step 54 fix: this originally took no query params at all, so exporting
 * always ignored whatever filters were active on screen — fixed to accept
 * the exact same status/search/dateFrom/dateTo GET /api/payments/extra
 * does, and mirror its where-clause, so the export matches what's visible.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = extraPaymentListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const { status, search, dateFrom, dateTo } = parsed.data;

  const where: Prisma.PaymentWhereInput = {
    purpose: "EXTRA",
    ...(status ? { status } : {}),
    ...(!isServiceScopeUnrestricted(auth.session) ? { booking: { lead: serviceTypeCondition(auth.session) } } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: "insensitive" as const } },
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
    orderBy: { createdAt: "asc" },
  });

  const csv = toCsv(payments, [
    { key: "bookingId", header: "Booking ID", value: (row) => row.booking.bookingId },
    { key: "leadReference", header: "Lead Reference", value: (row) => leadReference(row.booking.lead) },
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
