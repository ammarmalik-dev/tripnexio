import type { NextRequest } from "next/server";
import { refundListQuerySchema } from "@/lib/validation/refund-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("refunds.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = refundListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, dateFrom, dateTo, sort, page, pageSize } = parsed.data;

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

  const [total, refunds] = await Promise.all([
    db.refund.count({ where }),
    db.refund.findMany({
      where,
      include: { payment: { include: { booking: { include: { customer: true, lead: true } } } } },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = refunds.map((refund) => ({
    id: refund.id,
    paymentId: refund.paymentId,
    paidAmount: refund.paidAmount,
    cancellationCharge: refund.cancellationCharge,
    gatewayCharge: refund.gatewayCharge,
    refundAmount: refund.refundAmount,
    reason: refund.reason,
    status: refund.status,
    createdAt: refund.createdAt,
    bookingDisplayId: refund.payment.booking.bookingId,
    leadReferenceId: formatLeadReference(refund.payment.booking.lead.serviceType, refund.payment.booking.leadId),
    customer: { name: refund.payment.booking.customer.name, mobile: refund.payment.booking.customer.mobile },
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
