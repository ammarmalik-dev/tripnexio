import { db } from "../../db";
import { bookingScopeWhere, leadScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportColumn, ReportDefinition, ReportFilters, ReportResult } from "../types";
import type { ServiceType } from "../../../generated/prisma/enums";
import {
  ALL_SERVICE_TYPES,
  bucket,
  capRows,
  loadLeadMeta,
  loadSelectedQuotations,
  loadStaffNames,
  percentOf,
  serviceLabel,
  staffKeyOf,
  totalsFor,
} from "./shared";

interface SalesAcc {
  leads: number;
  converted: number;
  quotesSent: number;
  bookings: number;
  salesValue: number;
}

const emptyAcc = (): SalesAcc => ({ leads: 0, converted: 0, quotesSent: 0, bookings: 0, salesValue: 0 });

const columns: ReportColumn[] = [
  { key: "breakdown", label: "Breakdown", kind: "text" },
  { key: "name", label: "Service / Staff", kind: "text" },
  { key: "leadsCreated", label: "Leads created", kind: "number" },
  { key: "quotesSent", label: "Quotes sent", kind: "number" },
  { key: "convertedLeads", label: "Converted leads", kind: "number" },
  { key: "conversionPercent", label: "Conversion %", kind: "percent" },
  { key: "bookings", label: "Bookings", kind: "number" },
  { key: "salesValue", label: "Sales value", kind: "money" },
  { key: "averageBookingValue", label: "Avg booking value", kind: "money" },
];

function toRow(breakdown: string, name: string, acc: SalesAcc): Record<string, ReportCell> {
  return {
    breakdown,
    name,
    leadsCreated: acc.leads,
    quotesSent: acc.quotesSent,
    convertedLeads: acc.converted,
    conversionPercent: percentOf(acc.converted, acc.leads),
    bookings: acc.bookings,
    salesValue: round2(acc.salesValue),
    averageBookingValue: acc.bookings > 0 ? round2(acc.salesValue / acc.bookings) : null,
  };
}

async function run(filters: ReportFilters): Promise<ReportResult> {
  const leadScope = await leadScopeWhere(filters);
  const bookingScope = await bookingScopeWhere(filters);
  const range = { gte: filters.from, lt: filters.to };

  const leadGroups = await db.lead.groupBy({
    by: ["serviceType", "assignedStaffId", "status"],
    where: { ...leadScope, createdAt: range },
    _count: { _all: true },
  });
  const quotes = await db.quotation.findMany({
    where: { isDraft: false, sentAt: range, lead: leadScope },
    select: { leadId: true },
  });
  const bookings = await db.booking.findMany({
    where: { ...bookingScope, createdAt: range, status: { not: "CANCELLED" } },
    select: { leadId: true },
  });

  const leadIds = new Set<string>([...quotes.map((quote) => quote.leadId), ...bookings.map((booking) => booking.leadId)]);
  const leadMeta = await loadLeadMeta(leadIds);
  const selected = await loadSelectedQuotations(bookings.map((booking) => booking.leadId));

  const byService = new Map<ServiceType, SalesAcc>();
  const byStaff = new Map<string, SalesAcc>();
  const staffIds = new Set<string>();

  const add = (serviceType: ServiceType, staffId: string | null, apply: (acc: SalesAcc) => void) => {
    apply(bucket(byService, serviceType, emptyAcc));
    apply(bucket(byStaff, staffId ?? "", emptyAcc));
    if (staffId) staffIds.add(staffId);
  };

  for (const group of leadGroups) {
    const count = group._count._all;
    add(group.serviceType, group.assignedStaffId, (acc) => {
      acc.leads += count;
      if (group.status === "CONVERTED") acc.converted += count;
    });
  }
  for (const quote of quotes) {
    const meta = leadMeta.get(quote.leadId);
    if (meta) add(meta.serviceType, meta.assignedStaffId, (acc) => (acc.quotesSent += 1));
  }
  for (const booking of bookings) {
    const meta = leadMeta.get(booking.leadId);
    if (!meta) continue;
    const quote = selected.get(booking.leadId);
    const value = quote ? Math.max(0, quote.sellingPrice - quote.couponDiscount) : 0;
    add(meta.serviceType, meta.assignedStaffId, (acc) => {
      acc.bookings += 1;
      acc.salesValue += value;
    });
  }

  const staffNames = await loadStaffNames(staffIds);

  const serviceRows = ALL_SERVICE_TYPES.filter((serviceType) => byService.has(serviceType)).map((serviceType) =>
    toRow("By service", serviceLabel(serviceType), byService.get(serviceType) ?? emptyAcc())
  );
  const staffRows = [...byStaff.entries()]
    .map(([staffId, acc]) => ({ named: staffKeyOf(staffId || null, staffNames), acc }))
    .sort((a, b) => b.acc.salesValue - a.acc.salesValue || a.named.label.localeCompare(b.named.label))
    .map(({ named, acc }) => toRow("By staff", named.label, acc));

  const totals = totalsFor(columns, serviceRows);
  const totalLeads = totals.leadsCreated ?? 0;
  const totalBookings = totals.bookings ?? 0;
  totals.averageBookingValue = totalBookings > 0 ? round2((totals.salesValue ?? 0) / totalBookings) : null;

  const notes = [
    "Leads created: leads whose createdAt is in the range. Converted leads: those same leads whose status is now CONVERTED; Conversion % = converted / created.",
    "Quotes sent: non-draft quotations whose sentAt is in the range (revisions and alternatives each count).",
    "Bookings: bookings whose createdAt is in the range, excluding CANCELLED. Sales value = the lead's selected quotation selling price minus its coupon discount (ex GST and gateway fee); Avg booking value = sales value / bookings.",
    "Staff = the lead's current assignee. Totals are the sum of the By service rows only; By staff rows re-slice the same figures.",
    `Service and staff with no activity are omitted. Total conversion: ${percentOf(totals.convertedLeads ?? 0, totalLeads) ?? "n/a"}%.`,
  ];
  const rows = capRows([...serviceRows, ...staffRows], notes);
  return { columns, rows, totals, notes };
}

export const salesMisReport: ReportDefinition = {
  key: "sales-mis",
  title: "Sales MIS",
  group: "mis",
  description: "Leads, quotes sent, bookings, conversion and sales value per service and per staff member.",
  supportedFilters: ["serviceType", "countryId", "staffId", "vendorId"],
  run,
};
