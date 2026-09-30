import { db } from "../../db";
import { paymentTotal } from "../../payments/totals";
import { bookingScopeWhere, leadScopeWhere, paymentScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportDefinition } from "../types";
import {
  ALL_FILTERS,
  SOURCE_LIMIT,
  buildBuckets,
  businessOffsetMinutes,
  capRows,
  findInChunks,
  inRange,
  isoDate,
  loadBookingInfo,
  num,
  pct,
  serviceLabel,
  sourceLimitNote,
  sumColumns,
} from "./shared";

const DAY_MS = 24 * 60 * 60 * 1000;

export const monthlySalesReport: ReportDefinition = {
  key: "monthly-sales",
  title: "Monthly Sales",
  group: "finance",
  description: "Per month: leads received, bookings created, sales value booked and revenue collected.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const offset = await businessOffsetMinutes();
    const buckets = buildBuckets(filters, "month", offset);
    const leadScope = await leadScopeWhere(filters);
    const bookingScope = await bookingScopeWhere(filters);
    const paymentScope = await paymentScopeWhere(filters);

    const leads = await db.lead.findMany({
      where: { AND: [leadScope, { createdAt: inRange(filters) }] },
      select: { createdAt: true },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(leads.length, notes);

    const bookings = await db.booking.findMany({
      where: { AND: [bookingScope, { createdAt: inRange(filters), status: { notIn: ["CANCELLED", "REFUNDED"] } }] },
      select: { createdAt: true, leadId: true },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(bookings.length, notes);
    const quotes = await findInChunks(
      bookings.map((booking) => booking.leadId),
      (ids) =>
        db.quotation.findMany({
          where: { leadId: { in: ids }, isSelected: true },
          select: { leadId: true, sellingPrice: true },
          orderBy: { updatedAt: "desc" },
        })
    );
    const sellingByLead = new Map<string, number>();
    for (const quote of quotes) if (!sellingByLead.has(quote.leadId)) sellingByLead.set(quote.leadId, num(quote.sellingPrice));

    const payments = await db.payment.findMany({
      where: { AND: [paymentScope, { status: "SUCCESS", updatedAt: inRange(filters) }] },
      select: { updatedAt: true, amount: true, couponDiscount: true, gstAmount: true, gatewayFee: true },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(payments.length, notes);

    const perMonth = new Map(buckets.keys.map((key) => [key, { leads: 0, bookings: 0, salesValue: 0, revenue: 0, collected: 0 }]));
    for (const lead of leads) {
      const entry = perMonth.get(buckets.keyOf(lead.createdAt));
      if (entry) entry.leads += 1;
    }
    for (const booking of bookings) {
      const entry = perMonth.get(buckets.keyOf(booking.createdAt));
      if (!entry) continue;
      entry.bookings += 1;
      entry.salesValue += sellingByLead.get(booking.leadId) ?? 0;
    }
    for (const payment of payments) {
      const entry = perMonth.get(buckets.keyOf(payment.updatedAt));
      if (!entry) continue;
      entry.revenue += Math.max(0, num(payment.amount) - num(payment.couponDiscount));
      entry.collected += paymentTotal(payment);
    }

    const rows: Record<string, ReportCell>[] = buckets.keys.map((key) => {
      const entry = perMonth.get(key) ?? { leads: 0, bookings: 0, salesValue: 0, revenue: 0, collected: 0 };
      return {
        month: key,
        leads: entry.leads,
        bookings: entry.bookings,
        conversionPct: pct(entry.bookings, entry.leads),
        salesValue: round2(entry.salesValue),
        revenueCollected: round2(entry.revenue),
        totalCollected: round2(entry.collected),
      };
    });

    notes.push(
      "Months follow the business timezone (Admin > System Config).",
      "Leads by lead createdAt; bookings by booking createdAt, excluding CANCELLED/REFUNDED bookings.",
      "Sales value = selected quotation sellingPrice of the bookings created that month (booked, not necessarily paid).",
      "Revenue collected = SUCCESS payments by payment.updatedAt, amount minus coupon discount, ex GST and gateway fee. Total collected = what the customer paid (incl. GST and gateway fee).",
      "Conversion % compares bookings and leads created in the same month - they are not necessarily the same leads."
    );
    return {
      columns: [
        { key: "month", label: "Month", kind: "text" },
        { key: "leads", label: "Leads", kind: "number" },
        { key: "bookings", label: "Bookings", kind: "number" },
        { key: "conversionPct", label: "Bookings / leads %", kind: "percent" },
        { key: "salesValue", label: "Sales value", kind: "money" },
        { key: "revenueCollected", label: "Revenue collected", kind: "money" },
        { key: "totalCollected", label: "Total collected (incl. GST)", kind: "money" },
      ],
      rows,
      totals: sumColumns(rows, ["leads", "bookings", "salesValue", "revenueCollected", "totalCollected"]),
      notes,
    };
  },
};

const PAYMENT_STATUS_TEXT: Record<"PENDING" | "EXPIRED" | "FAILED" | "SUCCESS", string> = {
  PENDING: "Pending",
  EXPIRED: "Expired",
  FAILED: "Failed",
  SUCCESS: "Paid",
};

export const outstandingPaymentsReport: ReportDefinition = {
  key: "outstanding-payments",
  title: "Outstanding Payments",
  group: "finance",
  description: "Bookings with no successful payment whose latest payment is pending, expired or failed.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const scope = await bookingScopeWhere(filters);
    const bookings = await db.booking.findMany({
      where: {
        AND: [
          scope,
          {
            createdAt: inRange(filters),
            status: { notIn: ["CANCELLED", "REFUNDED"] },
            payments: { some: {}, none: { status: "SUCCESS" } },
          },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: SOURCE_LIMIT,
    });
    sourceLimitNote(bookings.length, notes);
    const bookingIds = bookings.map((booking) => booking.id);

    const payments = await findInChunks(bookingIds, (ids) =>
      db.payment.findMany({
        where: { bookingId: { in: ids } },
        select: {
          bookingId: true,
          status: true,
          createdAt: true,
          linkExpiresAt: true,
          method: true,
          amount: true,
          couponDiscount: true,
          gstAmount: true,
          gatewayFee: true,
        },
      })
    );
    const latestByBooking = new Map<string, (typeof payments)[number]>();
    const firstRequestByBooking = new Map<string, Date>();
    for (const payment of payments) {
      const latest = latestByBooking.get(payment.bookingId);
      if (!latest || payment.createdAt > latest.createdAt) latestByBooking.set(payment.bookingId, payment);
      const first = firstRequestByBooking.get(payment.bookingId);
      if (!first || payment.createdAt < first) firstRequestByBooking.set(payment.bookingId, payment.createdAt);
    }

    const info = await loadBookingInfo(bookingIds);
    const now = Date.now();
    const rows: Record<string, ReportCell>[] = [];
    for (const id of bookingIds) {
      const booking = info.get(id);
      const latest = latestByBooking.get(id);
      if (!booking || !latest || latest.status === "SUCCESS") continue;
      const firstRequest = firstRequestByBooking.get(id) ?? latest.createdAt;
      const linkLapsed = latest.status === "PENDING" && latest.linkExpiresAt !== null && latest.linkExpiresAt.getTime() < now;
      rows.push({
        bookingCreated: isoDate(booking.createdAt),
        bookingId: booking.reference,
        customer: booking.customerName,
        service: serviceLabel(booking.serviceType),
        staff: booking.staffName,
        amountDue: paymentTotal(latest),
        daysOutstanding: Math.max(0, Math.floor((now - firstRequest.getTime()) / DAY_MS)),
        linkStatus: `${PAYMENT_STATUS_TEXT[latest.status]}${linkLapsed ? " (link lapsed)" : ""}${latest.method === "BANK_TRANSFER" ? " - bank transfer" : ""}`,
        linkExpiresAt: latest.linkExpiresAt ? isoDate(latest.linkExpiresAt) : null,
      });
    }

    notes.push(
      "Date range applies to booking createdAt. CANCELLED and REFUNDED bookings are excluded, as are bookings with no payment raised yet.",
      "Amount due = the latest payment's customer-payable total ((amount - coupon) + GST + gateway fee).",
      "Days outstanding = days since the booking's first payment request was created, as of now."
    );
    return {
      columns: [
        { key: "bookingCreated", label: "Booking created", kind: "date" },
        { key: "bookingId", label: "Booking", kind: "text" },
        { key: "customer", label: "Customer", kind: "text" },
        { key: "service", label: "Service", kind: "text" },
        { key: "staff", label: "Staff", kind: "text" },
        { key: "amountDue", label: "Amount due", kind: "money" },
        { key: "daysOutstanding", label: "Days outstanding", kind: "number" },
        { key: "linkStatus", label: "Latest payment", kind: "text" },
        { key: "linkExpiresAt", label: "Link expires", kind: "date" },
      ],
      rows: capRows(rows, notes),
      totals: sumColumns(rows, ["amountDue"]),
      notes,
    };
  },
};
