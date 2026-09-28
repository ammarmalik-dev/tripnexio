import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { ServiceType } from "@/generated/prisma/enums";

function toNumber(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

/**
 * Business Rules §15 "Finance Reports + MIS" — item 1 "Revenue Report",
 * folding in item 13 "Service-wise Revenue Report" as one service-wise
 * breakdown section rather than a separate screen (same consolidation
 * judgment call as PnlReport combining several §15 line items). Reporting
 * only, no write path.
 *
 * Same scoping conventions as PnlReport (see that route's own doc comment,
 * not repeated here): revenue anchored to SUCCESS payments by updatedAt in
 * range; refunds scoped independently by their own createdAt; gateway
 * charges/GST shown as informational, not netted out of "Net Revenue"
 * (pass-through, not a revenue reduction) — Net Revenue here is Gross
 * Revenue - Coupon Discount - Refunds, distinct from PnlReport's Net P&L
 * (which also subtracts vendor cost and expenses — this report is revenue,
 * not profit). Vendor cost/margin are intentionally NOT shown here — §8's
 * own rule ("vendor cost and internal margin must never be customer-facing")
 * doesn't apply to an internal Admin report, but Revenue vs. Margin is
 * PnlReport's job, kept separate so this report answers "how much did we
 * bring in," not "how much did we keep."
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

  const payments = await db.payment.findMany({
    where: { status: "SUCCESS", updatedAt: { gte: fromDate, lte: toDateEndOfDay } },
    include: { booking: { include: { lead: true } } },
  });

  let grossRevenue = 0;
  let couponDiscount = 0;
  let gatewayCharges = 0;
  let gstCollected = 0;
  const byService = new Map<ServiceType, { serviceType: ServiceType; label: string; revenue: number; count: number }>();

  for (const payment of payments) {
    const amount = toNumber(payment.amount);
    grossRevenue += amount;
    couponDiscount += toNumber(payment.couponDiscount);
    gatewayCharges += toNumber(payment.gatewayFee);
    gstCollected += toNumber(payment.gstAmount);

    const serviceType = payment.booking.lead.serviceType;
    const existing = byService.get(serviceType);
    if (existing) {
      existing.revenue += amount;
      existing.count += 1;
    } else {
      byService.set(serviceType, { serviceType, label: SERVICE_TYPE_LABELS[serviceType], revenue: amount, count: 1 });
    }
  }

  const refunds = await db.refund.findMany({
    where: { status: "COMPLETED", createdAt: { gte: fromDate, lte: toDateEndOfDay } },
    select: { refundAmount: true },
  });
  const totalRefunds = refunds.reduce((sum, refund) => sum + toNumber(refund.refundAmount), 0);

  const netRevenue = grossRevenue - couponDiscount - totalRefunds;

  return jsonSuccess({
    from,
    to,
    paymentCount: payments.length,
    grossRevenue: grossRevenue.toFixed(2),
    couponDiscount: couponDiscount.toFixed(2),
    gatewayCharges: gatewayCharges.toFixed(2),
    gstCollected: gstCollected.toFixed(2),
    refunds: totalRefunds.toFixed(2),
    netRevenue: netRevenue.toFixed(2),
    byService: [...byService.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .map((entry) => ({ ...entry, revenue: entry.revenue.toFixed(2) })),
    assumptions: [
      "Revenue is scoped to Payments whose status became SUCCESS with an updatedAt in this range — Payment has no dedicated succeeded-at timestamp (same convention as the P&L Report).",
      "Gateway Charges and GST are shown as informational lines and are NOT subtracted from Net Revenue — they're collected from the customer as a pass-through, not a revenue reduction.",
      "Net Revenue = Gross Revenue − Coupon Discount − Refunds. Vendor cost and margin are intentionally not shown here — see the P&L Report for profit figures.",
    ],
  });
}
