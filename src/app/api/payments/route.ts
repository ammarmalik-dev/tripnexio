import type { NextRequest } from "next/server";
import { paymentListQuerySchema } from "@/lib/validation/payment-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { formatLeadReference } from "@/lib/leads/reference";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("payments.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = paymentListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, sort, page, pageSize } = parsed.data;

  const where = {
    ...(status ? { status } : {}),
    ...(!isServiceScopeUnrestricted(auth.session) ? { booking: { lead: serviceTypeCondition(auth.session) } } : {}),
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
    gatewayRef: payment.gatewayRef,
    createdAt: payment.createdAt,
    bookingId: payment.bookingId,
    bookingDisplayId: payment.booking.bookingId,
    leadReferenceId: formatLeadReference(payment.booking.lead.serviceType, payment.booking.leadId),
    customer: { name: payment.booking.customer.name, mobile: payment.booking.customer.mobile },
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
