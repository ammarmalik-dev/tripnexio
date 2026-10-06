import { db } from "../../db";
import type { Prisma } from "../../../generated/prisma/client";
import type { ServiceType } from "../../../generated/prisma/enums";
import { paymentTotal } from "../../payments/totals";
import { leadScopeWhere, paymentScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportDefinition, ReportFilters } from "../types";
import {
  ALL_FILTERS,
  ALL_SERVICE_TYPES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_PURPOSE_LABELS,
  ROW_LIMIT,
  SOURCE_LIMIT,
  buildBuckets,
  businessOffsetMinutes,
  dateOnlyRange,
  inRange,
  isoDate,
  loadBookingInfo,
  loadUserNames,
  num,
  pct,
  rangeDays,
  serviceLabel,
  sourceLimitNote,
  sumColumns,
} from "./shared";

const PAYMENT_DATE_NOTE = "Payments are dated by payment.updatedAt of SUCCESS rows (Payment has no dedicated succeeded-at timestamp) - same convention as the P&L report.";
/** Leaves room for the per-category subtotal rows within ROW_LIMIT. */
const EXPENSE_ROW_LIMIT = ROW_LIMIT - 500;
const REFUND_DATE_NOTE = "Refunds count only when COMPLETED, dated by refund.updatedAt (when it was completed).";

/** Refund where-clause carrying the shared lead scope. */
async function refundScopeWhere(filters: ReportFilters): Promise<Prisma.RefundWhereInput> {
  const lead = await leadScopeWhere(filters);
  return Object.keys(lead).length ? { payment: { booking: { lead } } } : {};
}

/** Service types to iterate: just the filtered one, or all. */
function servicesFor(filters: ReportFilters): ServiceType[] {
  return filters.serviceType ? [filters.serviceType] : ALL_SERVICE_TYPES;
}

// ---------------------------------------------------------------------------

export const expensesReport: ReportDefinition = {
  key: "expenses",
  title: "Expenses",
  group: "finance",
  description: "Expense entries in the range, grouped by category with category subtotals.",
  supportedFilters: [],
  async run(filters) {
    const notes: string[] = [];
    const offset = await businessOffsetMinutes();
    const expenses = await db.expense.findMany({
      where: { date: dateOnlyRange(filters, offset) },
      select: { date: true, amount: true, gstAmount: true, reference: true, note: true, categoryId: true, recordedById: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: EXPENSE_ROW_LIMIT,
    });
    let truncatedTotal: number | null = null;
    if (expenses.length >= EXPENSE_ROW_LIMIT) {
      const all = await db.expense.aggregate({ where: { date: dateOnlyRange(filters, offset) }, _sum: { amount: true, gstAmount: true } });
      truncatedTotal = num(all._sum.amount) + num(all._sum.gstAmount);
      notes.push(`Only the first ${EXPENSE_ROW_LIMIT.toLocaleString("en-IN")} expenses are listed (subtotals cover those); the footer total covers every matching expense.`);
    }

    const categories = await db.expenseCategory.findMany({
      where: { id: { in: [...new Set(expenses.map((expense) => expense.categoryId))] } },
      select: { id: true, name: true, displayOrder: true },
    });
    const users = await loadUserNames(expenses.map((expense) => expense.recordedById));
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    const byCategory = new Map<string, typeof expenses>();
    for (const expense of expenses) {
      const list = byCategory.get(expense.categoryId) ?? [];
      list.push(expense);
      byCategory.set(expense.categoryId, list);
    }
    const orderedCategoryIds = [...byCategory.keys()].sort((a, b) => {
      const ca = categoryById.get(a);
      const cb = categoryById.get(b);
      return (ca?.displayOrder ?? 0) - (cb?.displayOrder ?? 0) || (ca?.name ?? "").localeCompare(cb?.name ?? "");
    });

    const rows: Record<string, ReportCell>[] = [];
    let total = 0;
    for (const categoryId of orderedCategoryIds) {
      const list = byCategory.get(categoryId) ?? [];
      const name = categoryById.get(categoryId)?.name ?? "(unknown category)";
      let subtotal = 0;
      for (const expense of list) {
        const amount = num(expense.amount);
        const gst = num(expense.gstAmount);
        subtotal += amount + gst;
        rows.push({
          date: expense.date.toISOString().slice(0, 10),
          category: name,
          reference: expense.reference ?? "",
          amount: round2(amount),
          gstAmount: round2(gst),
          total: round2(amount + gst),
          note: expense.note ?? "",
          recordedBy: users.get(expense.recordedById) ?? null,
        });
      }
      total += subtotal;
      rows.push({ date: null, category: `${name} - subtotal`, reference: null, amount: null, gstAmount: null, total: round2(subtotal), note: `${list.length} expense${list.length === 1 ? "" : "s"}`, recordedBy: null });
    }

    notes.push(
      "Only the date filter applies: expenses are company-wide and aren't linked to a service, country, staff assignment or vendor.",
      "Dated by the expense's own date (calendar day). Each category ends with a subtotal row; the footer total counts each expense once."
    );
    return {
      columns: [
        { key: "date", label: "Date", kind: "date" },
        { key: "category", label: "Category", kind: "text" },
        { key: "reference", label: "Reference", kind: "text" },
        { key: "amount", label: "Amount", kind: "money" },
        { key: "gstAmount", label: "GST Amount", kind: "money" },
        { key: "total", label: "Total Amount", kind: "money" },
        { key: "note", label: "Note", kind: "text" },
        { key: "recordedBy", label: "Recorded by", kind: "text" },
      ],
      rows,
      totals: { total: round2(truncatedTotal ?? total) },
      notes,
    };
  },
};

// ---------------------------------------------------------------------------

export const gatewayChargesReport: ReportDefinition = {
  key: "gateway-charges",
  title: "Payment / Gateway Charges",
  group: "finance",
  description: "Per payment method and service: successful payments, amount collected, gateway fees and GST.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const scope = await paymentScopeWhere(filters);
    const rows: Record<string, ReportCell>[] = [];
    for (const serviceType of servicesFor(filters)) {
      const groups = await db.payment.groupBy({
        by: ["method"],
        where: { AND: [scope, { status: "SUCCESS", updatedAt: inRange(filters), booking: { lead: { serviceType } } }] },
        _count: { _all: true },
        _sum: { amount: true, couponDiscount: true, gstAmount: true, gatewayFee: true },
      });
      for (const group of groups) {
        const gst = num(group._sum.gstAmount);
        const fee = num(group._sum.gatewayFee);
        const collected = Math.max(0, num(group._sum.amount) - num(group._sum.couponDiscount)) + gst + fee;
        rows.push({
          method: PAYMENT_METHOD_LABELS[group.method],
          service: serviceLabel(serviceType),
          payments: group._count._all,
          collected: round2(collected),
          gatewayFee: round2(fee),
          gatewayFeePct: pct(fee, collected),
          gst: round2(gst),
        });
      }
    }
    rows.sort((a, b) => String(a.method).localeCompare(String(b.method)) || String(a.service).localeCompare(String(b.service)));

    return {
      columns: [
        { key: "method", label: "Method", kind: "text" },
        { key: "service", label: "Service", kind: "text" },
        { key: "payments", label: "Payments", kind: "number" },
        { key: "collected", label: "Collected", kind: "money" },
        { key: "gatewayFee", label: "Gateway fees", kind: "money" },
        { key: "gatewayFeePct", label: "Fee % of collected", kind: "percent" },
        { key: "gst", label: "GST", kind: "money" },
      ],
      rows,
      totals: sumColumns(rows, ["payments", "collected", "gatewayFee", "gst"]),
      notes: [
        PAYMENT_DATE_NOTE,
        "Collected = (amount - coupon discount) + GST + gateway fee - what the customer paid.",
        "Gateway fee is the fee charged to the customer on the payment (pass-through to the processor); the processor's actual deduction isn't tracked.",
      ],
    };
  },
};

// ---------------------------------------------------------------------------

export const collectionReport: ReportDefinition = {
  key: "collection",
  title: "Collection",
  group: "finance",
  description: "Every successful payment in the range with its GST, gateway fee and total collected.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const scope = await paymentScopeWhere(filters);
    const where: Prisma.PaymentWhereInput = { AND: [scope, { status: "SUCCESS", updatedAt: inRange(filters) }] };
    const payments = await db.payment.findMany({
      where,
      select: {
        updatedAt: true,
        bookingId: true,
        invoiceNumber: true,
        method: true,
        purpose: true,
        amount: true,
        couponDiscount: true,
        gstAmount: true,
        gatewayFee: true,
      },
      orderBy: { updatedAt: "asc" },
      take: ROW_LIMIT,
    });
    const info = await loadBookingInfo(payments.map((payment) => payment.bookingId));

    const rows: Record<string, ReportCell>[] = payments.map((payment) => {
      const booking = info.get(payment.bookingId);
      return {
        date: isoDate(payment.updatedAt),
        invoice: payment.invoiceNumber,
        bookingId: booking?.reference ?? null,
        customer: booking?.customerName ?? null,
        service: booking ? serviceLabel(booking.serviceType) : null,
        method: PAYMENT_METHOD_LABELS[payment.method],
        purpose: PAYMENT_PURPOSE_LABELS[payment.purpose],
        amount: round2(num(payment.amount)),
        couponDiscount: round2(num(payment.couponDiscount)),
        gst: round2(num(payment.gstAmount)),
        gatewayFee: round2(num(payment.gatewayFee)),
        totalCollected: paymentTotal(payment),
      };
    });

    let totals: Record<string, number | null> = sumColumns(rows, ["amount", "couponDiscount", "gst", "gatewayFee", "totalCollected"]);
    if (payments.length >= ROW_LIMIT) {
      // Totals over the full set, not just the listed rows.
      const all = await db.payment.aggregate({ where, _sum: { amount: true, couponDiscount: true, gstAmount: true, gatewayFee: true } });
      const amount = num(all._sum.amount);
      const coupon = num(all._sum.couponDiscount);
      const gst = num(all._sum.gstAmount);
      const fee = num(all._sum.gatewayFee);
      totals = { amount: round2(amount), couponDiscount: round2(coupon), gst: round2(gst), gatewayFee: round2(fee), totalCollected: round2(amount - coupon + gst + fee) };
      notes.push(`Only the first ${ROW_LIMIT.toLocaleString("en-IN")} payments are listed; the totals cover every matching payment.`);
    }

    notes.push(PAYMENT_DATE_NOTE, "Amount is the pre-discount base (includes any Protection Plan). Total collected = (amount - coupon) + GST + gateway fee.");
    return {
      columns: [
        { key: "date", label: "Date", kind: "date" },
        { key: "invoice", label: "Invoice", kind: "text" },
        { key: "bookingId", label: "Booking", kind: "text" },
        { key: "customer", label: "Customer", kind: "text" },
        { key: "service", label: "Service", kind: "text" },
        { key: "method", label: "Method", kind: "text" },
        { key: "purpose", label: "Purpose", kind: "text" },
        { key: "amount", label: "Amount", kind: "money" },
        { key: "couponDiscount", label: "Coupon", kind: "money" },
        { key: "gst", label: "GST", kind: "money" },
        { key: "gatewayFee", label: "Gateway fee", kind: "money" },
        { key: "totalCollected", label: "Total collected", kind: "money" },
      ],
      rows,
      totals,
      notes,
    };
  },
};

// ---------------------------------------------------------------------------

export const serviceRevenueReport: ReportDefinition = {
  key: "service-revenue",
  title: "Service-wise Revenue",
  group: "finance",
  description: "Per service: successful payments, revenue ex GST, GST, gross collected, completed refunds and net revenue.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const paymentScope = await paymentScopeWhere(filters);
    const refundScope = await refundScopeWhere(filters);
    const rows: Record<string, ReportCell>[] = [];
    for (const serviceType of servicesFor(filters)) {
      const paid = await db.payment.aggregate({
        where: { AND: [paymentScope, { status: "SUCCESS", updatedAt: inRange(filters), booking: { lead: { serviceType } } }] },
        _count: { _all: true },
        _sum: { amount: true, couponDiscount: true, gstAmount: true, gatewayFee: true },
      });
      const refunded = await db.refund.aggregate({
        where: { AND: [refundScope, { status: "COMPLETED", updatedAt: inRange(filters), payment: { booking: { lead: { serviceType } } } }] },
        _count: { _all: true },
        _sum: { refundAmount: true },
      });
      if (paid._count._all === 0 && refunded._count._all === 0) continue;
      const revenue = Math.max(0, num(paid._sum.amount) - num(paid._sum.couponDiscount));
      const gst = num(paid._sum.gstAmount);
      const fee = num(paid._sum.gatewayFee);
      const refunds = num(refunded._sum.refundAmount);
      rows.push({
        service: serviceLabel(serviceType),
        payments: paid._count._all,
        revenue: round2(revenue),
        gst: round2(gst),
        grossCollected: round2(revenue + gst + fee),
        refunds: round2(refunds),
        net: round2(revenue - refunds),
      });
    }
    rows.sort((a, b) => Number(b.revenue) - Number(a.revenue));

    return {
      columns: [
        { key: "service", label: "Service", kind: "text" },
        { key: "payments", label: "Payments", kind: "number" },
        { key: "revenue", label: "Revenue (ex GST)", kind: "money" },
        { key: "gst", label: "GST", kind: "money" },
        { key: "grossCollected", label: "Gross collected", kind: "money" },
        { key: "refunds", label: "Refunds", kind: "money" },
        { key: "net", label: "Net revenue", kind: "money" },
      ],
      rows,
      totals: sumColumns(rows, ["payments", "revenue", "gst", "grossCollected", "refunds", "net"]),
      notes: [
        PAYMENT_DATE_NOTE,
        REFUND_DATE_NOTE,
        "Revenue = amount - coupon discount (ex GST and gateway fee). Gross collected adds GST and gateway fee back. Net revenue = revenue - completed refunds (refund amounts are deducted in full; they aren't split into GST and base).",
      ],
    };
  },
};

// ---------------------------------------------------------------------------

export const financialSummaryReport: ReportDefinition = {
  key: "financial-summary",
  title: "Daily / Monthly Financial Summary",
  group: "finance",
  description: "One row per day (ranges up to 62 days) or per month: collected, revenue, GST, gateway fees, refunds, expenses and net.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const offset = await businessOffsetMinutes();
    const unit = rangeDays(filters) <= 62 ? "day" : "month";
    const buckets = buildBuckets(filters, unit, offset);
    const paymentScope = await paymentScopeWhere(filters);
    const refundScope = await refundScopeWhere(filters);

    const payments = await db.payment.findMany({
      where: { AND: [paymentScope, { status: "SUCCESS", updatedAt: inRange(filters) }] },
      select: { updatedAt: true, amount: true, couponDiscount: true, gstAmount: true, gatewayFee: true },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(payments.length, notes);
    const refunds = await db.refund.findMany({
      where: { AND: [refundScope, { status: "COMPLETED", updatedAt: inRange(filters) }] },
      select: { updatedAt: true, refundAmount: true },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(refunds.length, notes);
    const expenses = await db.expense.findMany({
      where: { date: dateOnlyRange(filters, offset) },
      select: { date: true, amount: true, gstAmount: true },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(expenses.length, notes);

    const empty = () => ({ payments: 0, collected: 0, revenue: 0, gst: 0, gatewayFees: 0, refunds: 0, expenses: 0 });
    const perBucket = new Map(buckets.keys.map((key) => [key, empty()]));
    for (const payment of payments) {
      const entry = perBucket.get(buckets.keyOf(payment.updatedAt));
      if (!entry) continue;
      entry.payments += 1;
      entry.collected += paymentTotal(payment);
      entry.revenue += Math.max(0, num(payment.amount) - num(payment.couponDiscount));
      entry.gst += num(payment.gstAmount);
      entry.gatewayFees += num(payment.gatewayFee);
    }
    for (const refund of refunds) {
      const entry = perBucket.get(buckets.keyOf(refund.updatedAt));
      if (entry) entry.refunds += num(refund.refundAmount);
    }
    for (const expense of expenses) {
      const entry = perBucket.get(buckets.keyOfDateOnly(expense.date));
      if (entry) entry.expenses += num(expense.amount) + num(expense.gstAmount);
    }

    const rows: Record<string, ReportCell>[] = buckets.keys.map((key) => {
      const entry = perBucket.get(key) ?? empty();
      return {
        period: key,
        payments: entry.payments,
        collected: round2(entry.collected),
        revenue: round2(entry.revenue),
        gst: round2(entry.gst),
        gatewayFees: round2(entry.gatewayFees),
        refunds: round2(entry.refunds),
        expenses: round2(entry.expenses),
        net: round2(entry.revenue - entry.refunds - entry.expenses),
      };
    });

    notes.push(
      `One row per ${unit} (daily for ranges up to 62 days, otherwise monthly), in the business timezone.`,
      PAYMENT_DATE_NOTE,
      REFUND_DATE_NOTE,
      "Expenses are dated by their own date and are company-wide - service/country/staff/vendor filters do NOT apply to them.",
      "Revenue = amount - coupon (ex GST and gateway fee). Collected = revenue + GST + gateway fee. Net = revenue - completed refunds - expenses; GST and gateway fees are pass-through and vendor cost is not deducted (see Profit & Margin)."
    );
    return {
      columns: [
        { key: "period", label: unit === "day" ? "Day" : "Month", kind: "text" },
        { key: "payments", label: "Payments", kind: "number" },
        { key: "collected", label: "Collected", kind: "money" },
        { key: "revenue", label: "Revenue (ex GST)", kind: "money" },
        { key: "gst", label: "GST", kind: "money" },
        { key: "gatewayFees", label: "Gateway fees", kind: "money" },
        { key: "refunds", label: "Refunds completed", kind: "money" },
        { key: "expenses", label: "Expenses", kind: "money" },
        { key: "net", label: "Net", kind: "money" },
      ],
      rows,
      totals: sumColumns(rows, ["payments", "collected", "revenue", "gst", "gatewayFees", "refunds", "expenses", "net"]),
      notes,
    };
  },
};
