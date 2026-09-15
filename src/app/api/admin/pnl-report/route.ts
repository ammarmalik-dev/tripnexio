import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

function toNumber(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

/**
 * Step 28 (audit §4.8) — ADMIN.md §29's P&L report, reporting-only (no
 * write path here). Every figure is a real, computed aggregate — never
 * estimated or fabricated.
 *
 * Scoping: the whole report is anchored to SUCCESS payments whose
 * `updatedAt` falls in [from, to] — the same "succeeded today" proxy
 * already used and disclosed in Step 27's TODAY_PAYMENTS_SUMMARY handler
 * (Payment has no dedicated succeeded-at timestamp). Vendor cost and
 * margin are pulled from those SAME bookings' selected quotations, so
 * revenue and its matched costs always reconcile to the same underlying
 * booking set for the period — not two independently-date-filtered
 * queries that could silently drift apart.
 *
 * Refunds are scoped independently, by the refund's OWN createdAt (a
 * refund issued this period reduces this period's net result regardless
 * of which period the original sale fell in — standard P&L practice, and
 * the only sensible interpretation here since Refund has no link back to
 * "the period its original payment was recognized in" beyond the payment
 * row itself, which this report deliberately doesn't re-join for refunds).
 *
 * Gateway Charges and GST are reported as their own informational lines
 * (ADMIN.md §29 lists "Gateway Charges" as its own reportable item) but
 * are NOT subtracted from Net P&L — CRM.md's own pricing formula treats
 * the gateway charge as collected from the customer specifically to cover
 * the processor's fee, i.e. a pass-through, not a margin-affecting cost.
 * This is a disclosed assumption (no "actual amount Razorpay charged"
 * tracking exists to verify it against), not a silent one — see the
 * `assumptions` field in the response and its rendering in the UI.
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
  // Inclusive of the entire `to` day — a bare date parses to that day's UTC
  // midnight, which would otherwise exclude anything that happened later
  // that same day.
  const toDateEndOfDay = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);

  const payments = await db.payment.findMany({
    where: { status: "SUCCESS", updatedAt: { gte: fromDate, lte: toDateEndOfDay } },
    include: { booking: { include: { lead: { include: { quotations: { where: { isSelected: true } } } } } } },
  });

  let revenue = 0;
  let couponDiscount = 0;
  let gatewayCharges = 0;
  let gstCollected = 0;
  let vendorCost = 0;
  let margin = 0;
  for (const payment of payments) {
    revenue += toNumber(payment.amount);
    couponDiscount += toNumber(payment.couponDiscount);
    gatewayCharges += toNumber(payment.gatewayFee);
    gstCollected += toNumber(payment.gstAmount);
    const quotation = payment.booking.lead.quotations[0];
    if (quotation) {
      vendorCost += toNumber(quotation.vendorCost);
      margin += toNumber(quotation.margin);
    }
  }

  const refunds = await db.refund.findMany({
    where: { status: "COMPLETED", createdAt: { gte: fromDate, lte: toDateEndOfDay } },
    select: { refundAmount: true },
  });
  const totalRefunds = refunds.reduce((sum, refund) => sum + toNumber(refund.refundAmount), 0);

  const expenses = await db.expense.findMany({
    where: { date: { gte: fromDate, lte: toDateEndOfDay } },
    include: { category: true },
  });
  const expensesByCategory = new Map<string, { categoryId: string; categoryName: string; total: number }>();
  for (const expense of expenses) {
    const existing = expensesByCategory.get(expense.categoryId);
    const amount = toNumber(expense.amount);
    if (existing) existing.total += amount;
    else expensesByCategory.set(expense.categoryId, { categoryId: expense.categoryId, categoryName: expense.category.name, total: amount });
  }
  const totalExpenses = [...expensesByCategory.values()].reduce((sum, entry) => sum + entry.total, 0);

  const netPnl = revenue - couponDiscount - vendorCost - totalRefunds - totalExpenses;

  return jsonSuccess({
    from,
    to,
    paymentCount: payments.length,
    revenue: revenue.toFixed(2),
    couponDiscount: couponDiscount.toFixed(2),
    vendorCost: vendorCost.toFixed(2),
    margin: margin.toFixed(2),
    gatewayCharges: gatewayCharges.toFixed(2),
    gstCollected: gstCollected.toFixed(2),
    refunds: totalRefunds.toFixed(2),
    expensesByCategory: [...expensesByCategory.values()]
      .sort((a, b) => b.total - a.total)
      .map((entry) => ({ ...entry, total: entry.total.toFixed(2) })),
    totalExpenses: totalExpenses.toFixed(2),
    netPnl: netPnl.toFixed(2),
    assumptions: [
      "Revenue is scoped to Payments whose status became SUCCESS with an updatedAt in this range — Payment has no dedicated succeeded-at timestamp.",
      "Gateway Charges and GST are shown as informational lines and are NOT subtracted from Net P&L — they're collected from the customer as a pass-through to the payment processor/tax authority, not a margin cost.",
      "Refunds are scoped by their own date, independent of which period the original payment fell in.",
    ],
  });
}
