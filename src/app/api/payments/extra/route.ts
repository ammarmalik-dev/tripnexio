import type { NextRequest } from "next/server";
import { extraPaymentListQuerySchema } from "@/lib/validation/extra-payment-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Step 52 (Internal Dashboard Merged §9) — "Show extra-payment
 * transactions in their own filterable, CSV-exportable report, separate
 * from the primary per-booking payment list." A dedicated list scoped to
 * `purpose: "EXTRA"` — mirrors GET /api/payments's own shape/pattern, not
 * a second implementation of the same filtering logic from scratch.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = extraPaymentListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, dateFrom, dateTo, sort, page, pageSize } = parsed.data;

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

  const [total, payments] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      include: { booking: { include: { customer: true, lead: true } } },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    gstAmount: payment.gstAmount,
    gatewayFee: payment.gatewayFee,
    status: payment.status,
    description: payment.description,
    gatewayRef: payment.gatewayRef,
    createdAt: payment.createdAt,
    bookingId: payment.bookingId,
    bookingDisplayId: payment.booking.bookingId,
    leadReferenceId: formatLeadReference(payment.booking.lead.serviceType, payment.booking.leadId),
    customer: { name: payment.booking.customer.name, mobile: payment.booking.customer.mobile },
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
