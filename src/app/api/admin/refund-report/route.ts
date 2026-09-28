import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { SERVICE_TYPE_LABELS, REFUND_STATUS_LABELS } from "@/lib/crm/labels";
import { leadReference } from "@/lib/leads/reference";
import type { RefundStatus, ServiceType } from "@/generated/prisma/enums";

function toNumber(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

/**
 * Business Rules §15 "Finance Reports + MIS" — item 8 "Refund Report".
 * Scoped by Refund.createdAt (when the refund was raised, not when its
 * original payment was recognized — same independent-scoping convention
 * PnlReport/RevenueReport already use for refunds). Reporting only.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("finance.manage");
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
    orderBy: { createdAt: "desc" },
  });

  let totalRefundAmount = 0;
  let completedAmount = 0;
  const byStatus = new Map<RefundStatus, { status: RefundStatus; label: string; count: number; amount: number }>();
  const byService = new Map<ServiceType, { serviceType: ServiceType; label: string; count: number; amount: number }>();

  for (const refund of refunds) {
    const amount = toNumber(refund.refundAmount);
    totalRefundAmount += amount;
    if (refund.status === "COMPLETED") completedAmount += amount;

    const statusEntry = byStatus.get(refund.status);
    if (statusEntry) {
      statusEntry.count += 1;
      statusEntry.amount += amount;
    } else {
      byStatus.set(refund.status, { status: refund.status, label: REFUND_STATUS_LABELS[refund.status], count: 1, amount });
    }

    const serviceType = refund.payment.booking.lead.serviceType;
    const serviceEntry = byService.get(serviceType);
    if (serviceEntry) {
      serviceEntry.count += 1;
      serviceEntry.amount += amount;
    } else {
      byService.set(serviceType, { serviceType, label: SERVICE_TYPE_LABELS[serviceType], count: 1, amount });
    }
  }

  return jsonSuccess({
    from,
    to,
    refundCount: refunds.length,
    totalRefundAmount: totalRefundAmount.toFixed(2),
    completedAmount: completedAmount.toFixed(2),
    byStatus: [...byStatus.values()].map((entry) => ({ ...entry, amount: entry.amount.toFixed(2) })),
    byService: [...byService.values()]
      .sort((a, b) => b.amount - a.amount)
      .map((entry) => ({ ...entry, amount: entry.amount.toFixed(2) })),
    rows: refunds.map((refund) => ({
      id: refund.id,
      bookingId: refund.payment.booking.bookingId,
      leadReference: leadReference(refund.payment.booking.lead),
      customerName: refund.payment.booking.customer.name,
      serviceType: SERVICE_TYPE_LABELS[refund.payment.booking.lead.serviceType],
      status: REFUND_STATUS_LABELS[refund.status],
      refundAmount: toNumber(refund.refundAmount).toFixed(2),
      reason: refund.reason ?? "",
      createdAt: refund.createdAt.toISOString(),
    })),
  });
}
