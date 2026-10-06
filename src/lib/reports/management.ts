import { db } from "../db";
import type { Prisma } from "../../generated/prisma/client";
import { paymentTotal } from "../payments/totals";
import { bookingScopeWhere, paymentScopeWhere, round2 } from "./scope";
import { previousPeriod } from "./query";
import type { ReportFilters } from "./types";

/**
 * P25 (Locked Business Rules v2.0 §15) — the management dashboard waterfall:
 * Sales → Revenue → Cost → Gross Profit → Refunds → Expenses → Net Profit,
 * plus GST liability and the period's net cash movement. All computed here,
 * server-side, from real rows — nothing estimated.
 *
 * Conventions follow /api/admin/pnl-report and src/lib/payments/totals.ts:
 * - A payment "succeeded in range" = status SUCCESS with updatedAt in range
 *   (Payment has no dedicated succeeded-at timestamp).
 * - Revenue per payment = amount − couponDiscount (clamped at 0, the same
 *   net figure paymentTotal() starts from), EXCLUDING GST and gateway fee —
 *   both are pass-throughs, not margin.
 * - Collected per payment = paymentTotal() (net + GST + gateway fee).
 *
 * Queries run one after another (the local prisma dev DB drops connections
 * under parallel bursts).
 */

export type ManagementLineKey =
  | "sales"
  | "revenue"
  | "cost"
  | "grossProfit"
  | "refunds"
  | "expenses"
  | "netProfit"
  | "gstLiability"
  | "cashPosition";

/** total = a level (bar from 0); decrease = subtracted from the running figure; info = shown beside the waterfall. */
export type ManagementLineKind = "total" | "decrease" | "info";

export interface ManagementLine {
  key: ManagementLineKey;
  label: string;
  kind: ManagementLineKind;
  value: number;
  previousValue: number;
  /** Plain-English definition, rendered on the dashboard. */
  definition: string;
  /** Short supporting detail, e.g. "12 bookings". */
  detail: string;
}

export interface ManagementReport {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  lines: ManagementLine[];
  /** Gross collected (payment totals incl. GST & gateway fee) — the inflow side of Net Cash Movement. */
  collected: number;
  previousCollected: number;
  notes: string[];
}

interface PeriodFigures {
  sales: number;
  bookingCount: number;
  revenue: number;
  paymentCount: number;
  cost: number;
  costBookingCount: number;
  grossProfit: number;
  refunds: number;
  refundCount: number;
  expenses: number;
  expenseCount: number;
  netProfit: number;
  gstCollected: number;
  gstLiability: number;
  collected: number;
  cashPosition: number;
}

function num(value: { toString(): string } | null | undefined): number {
  return value == null ? 0 : Number(value.toString());
}

async function computePeriod(filters: ReportFilters): Promise<PeriodFigures> {
  const range = { gte: filters.from, lt: filters.to };
  // Scope wheres run their own (sequential) country lookup before the main queries.
  const bookingScope = await bookingScopeWhere(filters);
  const paymentScope = await paymentScopeWhere(filters);
  const refundScope: Prisma.RefundWhereInput = Object.keys(paymentScope).length ? { payment: paymentScope } : {};

  // Sales — bookings created in range, valued at their lead's selected quotation (selling price − coupon discount).
  const bookings = await db.booking.findMany({
    where: { AND: [bookingScope, { createdAt: range }] },
    select: {
      lead: { select: { quotations: { where: { isSelected: true }, select: { sellingPrice: true, couponDiscount: true }, take: 1 } } },
    },
  });
  let sales = 0;
  for (const booking of bookings) {
    const quotation = booking.lead.quotations[0];
    if (quotation) sales += Math.max(0, num(quotation.sellingPrice) - num(quotation.couponDiscount));
  }

  // Revenue / GST / collected — SUCCESS payments in range (by updatedAt). Cost from the same bookings.
  const payments = await db.payment.findMany({
    where: { AND: [paymentScope, { status: "SUCCESS", updatedAt: range }] },
    select: {
      bookingId: true,
      purpose: true,
      amount: true,
      couponDiscount: true,
      gstAmount: true,
      gatewayFee: true,
      booking: { select: { lead: { select: { quotations: { where: { isSelected: true }, select: { vendorCost: true }, take: 1 } } } } },
    },
  });
  let revenue = 0;
  let gstCollected = 0;
  let collected = 0;
  const costByBooking = new Map<string, number>();
  for (const payment of payments) {
    revenue += Math.max(0, num(payment.amount) - num(payment.couponDiscount));
    gstCollected += num(payment.gstAmount);
    collected += paymentTotal(payment);
    // A booking's vendor cost is recognised once, in the period its PRIMARY payment succeeded —
    // an EXTRA (add-on) payment later must not count the same vendor cost again.
    if (payment.purpose === "PRIMARY" && !costByBooking.has(payment.bookingId)) {
      costByBooking.set(payment.bookingId, num(payment.booking.lead.quotations[0]?.vendorCost));
    }
  }
  const cost = [...costByBooking.values()].reduce((sum, value) => sum + value, 0);

  // Refunds — COMPLETED refunds whose updatedAt (≈ completion time) falls in range.
  const refundRows = await db.refund.findMany({
    where: { AND: [refundScope, { status: "COMPLETED", updatedAt: range }] },
    select: { refundAmount: true },
  });
  const refunds = refundRows.reduce((sum, refund) => sum + num(refund.refundAmount), 0);

  // Expenses — dated in range. Service/country/staff/vendor filters never apply (expenses aren't tied to a lead).
  // Client corrections 2026-10-05 — an expense costs its total, GST included.
  const expenseRows = await db.expense.findMany({ where: { date: range }, select: { amount: true, gstAmount: true } });
  const expenses = expenseRows.reduce((sum, expense) => sum + num(expense.amount) + num(expense.gstAmount), 0);

  const grossProfit = revenue - cost;
  const netProfit = grossProfit - refunds - expenses;
  // Refund rows carry no GST split, so GST refunded can't be netted off — liability = GST collected.
  const gstLiability = gstCollected;
  const cashPosition = collected - refunds - expenses;

  return {
    sales: round2(sales),
    bookingCount: bookings.length,
    revenue: round2(revenue),
    paymentCount: payments.length,
    cost: round2(cost),
    costBookingCount: costByBooking.size,
    grossProfit: round2(grossProfit),
    refunds: round2(refunds),
    refundCount: refundRows.length,
    expenses: round2(expenses),
    expenseCount: expenseRows.length,
    netProfit: round2(netProfit),
    gstCollected: round2(gstCollected),
    gstLiability: round2(gstLiability),
    collected: round2(collected),
    cashPosition: round2(cashPosition),
  };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Inclusive last day of an exclusive-end range. */
function lastDay(exclusiveEnd: Date): string {
  return isoDay(new Date(exclusiveEnd.getTime() - 24 * 60 * 60 * 1000));
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export async function buildManagementReport(filters: ReportFilters): Promise<ManagementReport> {
  const previousFilters = previousPeriod(filters);
  const current = await computePeriod(filters);
  const previous = await computePeriod(previousFilters);

  const lines: ManagementLine[] = [
    {
      key: "sales",
      label: "Sales",
      kind: "total",
      value: current.sales,
      previousValue: previous.sales,
      definition: "Total value of bookings created in the period: the lead's selected quotation selling price minus its coupon discount. Includes bookings later cancelled (any money returned shows under Refunds).",
      detail: plural(current.bookingCount, "booking"),
    },
    {
      key: "revenue",
      label: "Revenue",
      kind: "total",
      value: current.revenue,
      previousValue: previous.revenue,
      definition: "Successful payments in the period (status SUCCESS, dated by the payment's last update): amount minus coupon discount, excluding GST and gateway fee. Same basis as the P&L report.",
      detail: plural(current.paymentCount, "payment"),
    },
    {
      key: "cost",
      label: "Cost",
      kind: "decrease",
      value: current.cost,
      previousValue: previous.cost,
      definition: "Vendor cost of the selected quotation, for bookings whose primary payment succeeded in the period (counted once per booking).",
      detail: plural(current.costBookingCount, "booking"),
    },
    {
      key: "grossProfit",
      label: "Gross Profit",
      kind: "total",
      value: current.grossProfit,
      previousValue: previous.grossProfit,
      definition: "Revenue − Cost.",
      detail: "",
    },
    {
      key: "refunds",
      label: "Refunds",
      kind: "decrease",
      value: current.refunds,
      previousValue: previous.refunds,
      definition: "Refunds marked COMPLETED in the period (dated by the refund's last update), regardless of when the original payment was made.",
      detail: plural(current.refundCount, "refund"),
    },
    {
      key: "expenses",
      label: "Expenses",
      kind: "decrease",
      value: current.expenses,
      previousValue: previous.expenses,
      definition: "Operating expenses dated in the period (Admin → Expenses). Service, country, staff and vendor filters do not apply to expenses.",
      detail: plural(current.expenseCount, "expense"),
    },
    {
      key: "netProfit",
      label: "Net Profit",
      kind: "total",
      value: current.netProfit,
      previousValue: previous.netProfit,
      definition: "Gross Profit − Refunds − Expenses.",
      detail: "",
    },
    {
      key: "gstLiability",
      label: "GST Liability",
      kind: "info",
      value: current.gstLiability,
      previousValue: previous.gstLiability,
      definition: "GST collected on successful payments in the period. GST refunded is not tracked separately on refunds, so it is not netted off here.",
      detail: "",
    },
    {
      key: "cashPosition",
      label: "Net Cash Movement",
      kind: "info",
      value: current.cashPosition,
      previousValue: previous.cashPosition,
      definition: "Net cash movement in the period: everything collected on successful payments (including GST and gateway fee) − completed refunds − expenses. Not a bank balance — no bank ledger exists in the system.",
      detail: "",
    },
  ];

  const notes = [
    "Payment has no dedicated succeeded-at timestamp, so a payment's last update time stands in for when it succeeded (same as the P&L report).",
    "Refund rows don't record how much of the refund was GST, so GST liability is GST collected, not net of refunds.",
    "Expenses are company-wide: the service, country, staff and vendor filters narrow every other figure but never expenses.",
    "Net Cash Movement is the period's net inflow/outflow, not a bank or cash balance — there is no bank ledger to reconcile against.",
    `Comparison period: ${isoDay(previousFilters.from)} to ${lastDay(previousFilters.to)} (the same number of days immediately before).`,
  ];

  return {
    from: isoDay(filters.from),
    to: lastDay(filters.to),
    previousFrom: isoDay(previousFilters.from),
    previousTo: lastDay(previousFilters.to),
    lines,
    collected: current.collected,
    previousCollected: previous.collected,
    notes,
  };
}
