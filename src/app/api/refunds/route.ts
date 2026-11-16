import type { NextRequest } from "next/server";
import { refundListQuerySchema } from "@/lib/validation/refund-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { leadReference } from "@/lib/leads/reference";
import { paymentTotal } from "@/lib/payments/totals";
import { syncRefundWithGateway } from "@/lib/refunds/finalize-refund";

export async function GET(request: NextRequest) {
  const auth = await requirePermission("refunds.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = refundListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }

  const { status, search, dateFrom, dateTo, sort, page, pageSize, serviceType, assignedStaffId, refundType, method } = parsed.data;

  // Client doc 2026-10-15 (I5) — refunds still processing at the gateway follow its real result when the list
  // loads (a few at a time, oldest first, at most every 10 minutes each), so staff rarely need "Check gateway".
  const stale = await db.refund.findMany({
    where: { status: "PROCESSING", gatewayRefundId: { not: null }, updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    orderBy: { updatedAt: "asc" },
    take: 3,
    select: { id: true },
  });
  for (const row of stale) {
    const result = await syncRefundWithGateway(row.id, { userId: auth.session.id, label: "gateway check" });
    if (!result.ok || !result.changed) await db.refund.update({ where: { id: row.id }, data: { updatedAt: new Date() } });
  }

  const bookingFilter = {
    ...(serviceType ? { serviceType } : {}),
    ...(assignedStaffId ? { assignedStaffId: assignedStaffId === "unassigned" ? null : assignedStaffId } : {}),
  };
  const where = {
    ...(status ? { status } : {}),
    // Client doc 16 Nov (H9) — a partial refund names its passengers; a full one covers the whole booking.
    ...(refundType === "PARTIAL" ? { NOT: { passengerIds: { isEmpty: true } } } : refundType === "FULL" ? { passengerIds: { isEmpty: true } } : {}),
    ...(method || Object.keys(bookingFilter).length > 0
      ? { payment: { ...(method ? { method } : {}), ...(Object.keys(bookingFilter).length > 0 ? { booking: { lead: bookingFilter } } : {}) } }
      : {}),
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
      include: { payment: { include: { booking: { include: { customer: true, lead: { include: { assignedStaff: { select: { name: true } } } } } } } } },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const raisers = await db.user.findMany({
    where: { id: { in: [...new Set(refunds.map((refund) => refund.raisedByUserId).filter((id): id is string => !!id))] } },
    select: { id: true, name: true },
  });
  const items = refunds.map((refund) => ({
    id: refund.id,
    paymentId: refund.paymentId,
    paidAmount: refund.paidAmount,
    cancellationCharge: refund.cancellationCharge,
    gatewayCharge: refund.gatewayCharge,
    refundAmount: refund.refundAmount,
    reason: refund.reason,
    status: refund.status,
    gatewayRefundId: refund.gatewayRefundId,
    gatewayRefundStatus: refund.gatewayRefundStatus,
    createdAt: refund.createdAt,
    bookingDisplayId: refund.payment.booking.bookingId,
    bookingId: refund.payment.booking.id,
    // Client doc 2026-10-20 (L10) — the same Refund ID the customer's messages quote.
    // Client doc 16 Nov (H7) — only the gateway's own refund ID (a bank-transfer refund shows its transaction number).
    refundReference: refund.gatewayRefundId ?? refund.bankTransactionRef ?? null,
    leadReferenceId: leadReference(refund.payment.booking.lead),
    customer: { name: refund.payment.booking.customer.name, mobile: refund.payment.booking.customer.mobile },
    // Client doc 16 Nov (H9) — Created By, POC, Service, Refund Type, Refund Method, Collected Amount.
    createdBy: raisers.find((user) => user.id === refund.raisedByUserId)?.name ?? null,
    poc: refund.payment.booking.lead.assignedStaff?.name ?? null,
    serviceType: refund.payment.booking.lead.serviceType,
    refundType: refund.passengerIds.length > 0 ? "PARTIAL" : "FULL",
    method: refund.payment.method,
    collectedAmount: paymentTotal(refund.payment),
    bankTransactionRef: refund.bankTransactionRef,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
