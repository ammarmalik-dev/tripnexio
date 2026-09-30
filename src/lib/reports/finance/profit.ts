import type { ServiceType } from "../../../generated/prisma/enums";
import { round2 } from "../scope";
import type { ReportCell, ReportDefinition } from "../types";
import {
  ALL_FILTERS,
  RECOGNITION_NOTE,
  capRows,
  isoDate,
  loadRecognisedBookings,
  pct,
  serviceLabel,
  sumColumns,
  type RecognisedBooking,
} from "./shared";

const NO_QUOTE_NOTE = "Bookings without a selected quotation show vendor \"(no selected quotation)\" with zero vendor cost.";
const EXTRA_COST_NOTE = "Extra payments (fare differences etc.) add revenue, but no extra vendor cost is recorded for them - their full value shows as profit.";

interface ProfitAgg {
  bookings: number;
  revenue: number;
  vendorCost: number;
  profit: number;
}

function aggregateByService(bookings: RecognisedBooking[]): Map<ServiceType, ProfitAgg> {
  const byService = new Map<ServiceType, ProfitAgg>();
  for (const booking of bookings) {
    const entry = byService.get(booking.serviceType) ?? { bookings: 0, revenue: 0, vendorCost: 0, profit: 0 };
    entry.bookings += 1;
    entry.revenue += booking.revenue;
    entry.vendorCost += booking.vendorCost;
    entry.profit += booking.profit;
    byService.set(booking.serviceType, entry);
  }
  return byService;
}

export const vendorPaymentsReport: ReportDefinition = {
  key: "vendor-payments",
  title: "Vendor Payments / Vendor Cost",
  group: "finance",
  description: "Per vendor and service: bookings, vendor cost owed, selling value and margin from the selected quotations.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const bookings = await loadRecognisedBookings(filters, notes);

    const groups = new Map<string, { vendor: string; service: string; bookings: number; vendorCost: number; sellingTotal: number; margin: number }>();
    for (const booking of bookings) {
      const vendor = booking.vendorName ?? "(no selected quotation)";
      const key = `${booking.vendorId ?? ""}|${booking.serviceType}`;
      const entry = groups.get(key) ?? { vendor, service: serviceLabel(booking.serviceType), bookings: 0, vendorCost: 0, sellingTotal: 0, margin: 0 };
      entry.bookings += 1;
      entry.vendorCost += booking.vendorCost;
      entry.sellingTotal += booking.sellingPrice;
      entry.margin += booking.quoteMargin;
      groups.set(key, entry);
    }

    const rows: Record<string, ReportCell>[] = [...groups.values()]
      .sort((a, b) => a.vendor.localeCompare(b.vendor) || a.service.localeCompare(b.service))
      .map((entry) => ({
        vendor: entry.vendor,
        service: entry.service,
        bookings: entry.bookings,
        vendorCost: round2(entry.vendorCost),
        sellingTotal: round2(entry.sellingTotal),
        margin: round2(entry.margin),
        marginPct: pct(entry.margin, entry.sellingTotal),
      }));

    notes.push(
      "Bookings are counted in the period their first successful payment falls in (payment.updatedAt of the SUCCESS row).",
      "Vendor cost, selling total and margin come from each booking's selected quotation (vendorCost, sellingPrice, margin) - quoted values, not collected cash.",
      NO_QUOTE_NOTE
    );
    return {
      columns: [
        { key: "vendor", label: "Vendor", kind: "text" },
        { key: "service", label: "Service", kind: "text" },
        { key: "bookings", label: "Bookings", kind: "number" },
        { key: "vendorCost", label: "Vendor cost", kind: "money" },
        { key: "sellingTotal", label: "Selling total", kind: "money" },
        { key: "margin", label: "Margin", kind: "money" },
        { key: "marginPct", label: "Margin %", kind: "percent" },
      ],
      rows: capRows(rows, notes),
      totals: sumColumns(rows, ["bookings", "vendorCost", "sellingTotal", "margin"]),
      notes,
    };
  },
};

export const profitMarginReport: ReportDefinition = {
  key: "profit-margin",
  title: "Profit & Margin",
  group: "finance",
  description: "Revenue, vendor cost, gross profit and margin % - overall and by service.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const bookings = await loadRecognisedBookings(filters, notes);
    const byService = aggregateByService(bookings);

    const overall: ProfitAgg = { bookings: 0, revenue: 0, vendorCost: 0, profit: 0 };
    for (const entry of byService.values()) {
      overall.bookings += entry.bookings;
      overall.revenue += entry.revenue;
      overall.vendorCost += entry.vendorCost;
      overall.profit += entry.profit;
    }

    const toRow = (scope: string, entry: ProfitAgg): Record<string, ReportCell> => ({
      scope,
      bookings: entry.bookings,
      revenue: round2(entry.revenue),
      vendorCost: round2(entry.vendorCost),
      grossProfit: round2(entry.profit),
      marginPct: pct(entry.profit, entry.revenue),
      profitSharePct: pct(entry.profit, overall.profit),
    });

    const rows: Record<string, ReportCell>[] = [
      toRow("All services", overall),
      ...[...byService.entries()].sort((a, b) => b[1].profit - a[1].profit).map(([service, entry]) => toRow(serviceLabel(service), entry)),
    ];

    notes.push(
      RECOGNITION_NOTE,
      "Gross profit = revenue - vendor cost. Margin % = gross profit / revenue. Expenses, refunds and GST are not deducted here (see Financial Summary / P&L).",
      "The first row is the overall total; the service rows add up to it, so no separate footer total is shown.",
      EXTRA_COST_NOTE
    );
    return {
      columns: [
        { key: "scope", label: "Service", kind: "text" },
        { key: "bookings", label: "Bookings", kind: "number" },
        { key: "revenue", label: "Revenue", kind: "money" },
        { key: "vendorCost", label: "Vendor cost", kind: "money" },
        { key: "grossProfit", label: "Gross profit", kind: "money" },
        { key: "marginPct", label: "Margin %", kind: "percent" },
        { key: "profitSharePct", label: "Share of profit %", kind: "percent" },
      ],
      rows,
      notes,
    };
  },
};

export const profitPerBookingReport: ReportDefinition = {
  key: "profit-per-booking",
  title: "Profit per Booking",
  group: "finance",
  description: "One row per booking recognised in the range: revenue, vendor cost, profit and margin %.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const bookings = await loadRecognisedBookings(filters, notes);
    const rows: Record<string, ReportCell>[] = bookings.map((booking) => ({
      recognisedAt: isoDate(booking.recognisedAt),
      bookingId: booking.reference,
      service: serviceLabel(booking.serviceType),
      customer: booking.customerName,
      staff: booking.staffName,
      vendor: booking.vendorName,
      payments: booking.successfulPayments,
      revenue: booking.revenue,
      vendorCost: round2(booking.vendorCost),
      profit: booking.profit,
      marginPct: pct(booking.profit, booking.revenue),
    }));

    notes.push(RECOGNITION_NOTE, NO_QUOTE_NOTE, EXTRA_COST_NOTE);
    return {
      columns: [
        { key: "recognisedAt", label: "First payment", kind: "date" },
        { key: "bookingId", label: "Booking", kind: "text" },
        { key: "service", label: "Service", kind: "text" },
        { key: "customer", label: "Customer", kind: "text" },
        { key: "staff", label: "Staff", kind: "text" },
        { key: "vendor", label: "Vendor", kind: "text" },
        { key: "payments", label: "Payments", kind: "number" },
        { key: "revenue", label: "Revenue", kind: "money" },
        { key: "vendorCost", label: "Vendor cost", kind: "money" },
        { key: "profit", label: "Profit", kind: "money" },
        { key: "marginPct", label: "Margin %", kind: "percent" },
      ],
      rows: capRows(rows, notes),
      totals: sumColumns(rows, ["payments", "revenue", "vendorCost", "profit"]),
      notes,
    };
  },
};

export const profitPerServiceReport: ReportDefinition = {
  key: "profit-per-service",
  title: "Profit per Service",
  group: "finance",
  description: "Per service: bookings, revenue, vendor cost, profit, margin % and average profit per booking.",
  supportedFilters: ALL_FILTERS,
  async run(filters) {
    const notes: string[] = [];
    const bookings = await loadRecognisedBookings(filters, notes);
    const rows: Record<string, ReportCell>[] = [...aggregateByService(bookings).entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([service, entry]) => ({
        service: serviceLabel(service),
        bookings: entry.bookings,
        revenue: round2(entry.revenue),
        vendorCost: round2(entry.vendorCost),
        profit: round2(entry.profit),
        marginPct: pct(entry.profit, entry.revenue),
        avgProfit: entry.bookings ? round2(entry.profit / entry.bookings) : null,
      }));

    notes.push(RECOGNITION_NOTE, "Profit = revenue - vendor cost; margin % = profit / revenue.", EXTRA_COST_NOTE);
    return {
      columns: [
        { key: "service", label: "Service", kind: "text" },
        { key: "bookings", label: "Bookings", kind: "number" },
        { key: "revenue", label: "Revenue", kind: "money" },
        { key: "vendorCost", label: "Vendor cost", kind: "money" },
        { key: "profit", label: "Profit", kind: "money" },
        { key: "marginPct", label: "Margin %", kind: "percent" },
        { key: "avgProfit", label: "Avg profit / booking", kind: "money" },
      ],
      rows,
      totals: sumColumns(rows, ["bookings", "revenue", "vendorCost", "profit"]),
      notes,
    };
  },
};
