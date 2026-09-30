import { db } from "../../db";
import { computeVendorScore, getVendorScoringWeights } from "../../vendors/scoring";
import { bookingScopeWhere, paymentScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportColumn, ReportDefinition, ReportFilters, ReportResult } from "../types";
import { bucket, capRows, inChunks, loadBookingLeadIds, loadPaymentBookingIds, loadSelectedQuotations, num, percentOf, serviceLabel, totalsFor } from "./shared";

interface VendorAcc {
  bookings: number;
  vendorCost: number;
  selling: number;
  margin: number;
  marginPercentSum: number;
  marginPercentCount: number;
  refunds: number;
}

const emptyAcc = (): VendorAcc => ({ bookings: 0, vendorCost: 0, selling: 0, margin: 0, marginPercentSum: 0, marginPercentCount: 0, refunds: 0 });

const columns: ReportColumn[] = [
  { key: "vendor", label: "Vendor", kind: "text" },
  { key: "services", label: "Services", kind: "text" },
  { key: "bookings", label: "Bookings", kind: "number" },
  { key: "vendorCost", label: "Vendor cost", kind: "money" },
  { key: "selling", label: "Selling", kind: "money" },
  { key: "margin", label: "Margin", kind: "money" },
  { key: "averageMarginPercent", label: "Avg margin %", kind: "percent" },
  { key: "refunds", label: "Refunds", kind: "money" },
  { key: "score", label: "Vendor score (1-5)", kind: "number" },
];

async function run(filters: ReportFilters): Promise<ReportResult> {
  const bookingScope = await bookingScopeWhere(filters);
  const paymentScope = await paymentScopeWhere(filters);
  const range = { gte: filters.from, lt: filters.to };

  const bookings = await db.booking.findMany({
    where: { ...bookingScope, createdAt: range, status: { not: "CANCELLED" } },
    select: { leadId: true },
  });
  const refunds = await db.refund.findMany({
    where: { status: "COMPLETED", createdAt: range, payment: paymentScope },
    select: { paymentId: true, refundAmount: true },
  });
  const refundBookingByPayment = await loadPaymentBookingIds(refunds.map((refund) => refund.paymentId));
  const refundLeadByBooking = await loadBookingLeadIds(refundBookingByPayment.values());
  const selected = await loadSelectedQuotations([...bookings.map((booking) => booking.leadId), ...refundLeadByBooking.values()]);

  const byVendor = new Map<string, VendorAcc>();
  let unattributed = 0;
  for (const booking of bookings) {
    const quote = selected.get(booking.leadId);
    if (!quote) {
      unattributed += 1;
      continue;
    }
    const acc = bucket(byVendor, quote.vendorId, emptyAcc);
    acc.bookings += 1;
    acc.vendorCost += quote.vendorCost;
    acc.selling += quote.sellingPrice;
    acc.margin += quote.margin;
    if (quote.sellingPrice > 0) {
      acc.marginPercentSum += (quote.margin / quote.sellingPrice) * 100;
      acc.marginPercentCount += 1;
    }
  }
  for (const refund of refunds) {
    const bookingId = refundBookingByPayment.get(refund.paymentId);
    const leadId = bookingId ? refundLeadByBooking.get(bookingId) : undefined;
    const quote = leadId ? selected.get(leadId) : undefined;
    if (quote) bucket(byVendor, quote.vendorId, emptyAcc).refunds += num(refund.refundAmount);
  }

  // Vendor list: every active vendor in scope (so idle vendors show too) plus any vendor with activity.
  const activeVendors = await db.vendor.findMany({
    where: {
      active: true,
      ...(filters.vendorId ? { id: filters.vendorId } : {}),
      ...(filters.serviceType ? { services: { some: { service: filters.serviceType } } } : {}),
    },
    select: { id: true },
  });
  const vendorIds = new Set<string>([...activeVendors.map((vendor) => vendor.id), ...byVendor.keys()]);
  const vendors = await inChunks(vendorIds, (chunk) =>
    db.vendor.findMany({
      where: { id: { in: chunk } },
      select: {
        id: true,
        name: true,
        active: true,
        serviceSuitabilityScore: true,
        processingTimeScore: true,
        performanceScore: true,
        reliabilityScore: true,
      },
    })
  );
  const vendorServices = await inChunks(vendorIds, (chunk) =>
    db.vendorService.findMany({ where: { vendorId: { in: chunk } }, select: { vendorId: true, service: true }, orderBy: { service: "asc" } })
  );
  const servicesByVendor = new Map<string, string[]>();
  for (const row of vendorServices) bucket(servicesByVendor, row.vendorId, (): string[] => []).push(serviceLabel(row.service));

  const weights = await getVendorScoringWeights();
  const rows: Record<string, ReportCell>[] = vendors
    .map((vendor) => {
      const acc = byVendor.get(vendor.id) ?? emptyAcc();
      return {
        vendor: vendor.active ? vendor.name : `${vendor.name} (inactive)`,
        services: [...new Set(servicesByVendor.get(vendor.id) ?? [])].join(", ") || "-",
        bookings: acc.bookings,
        vendorCost: round2(acc.vendorCost),
        selling: round2(acc.selling),
        margin: round2(acc.margin),
        averageMarginPercent: acc.marginPercentCount > 0 ? round2(acc.marginPercentSum / acc.marginPercentCount) : null,
        refunds: round2(acc.refunds),
        score: computeVendorScore(vendor, weights),
      };
    })
    .sort((a, b) => b.selling - a.selling || b.bookings - a.bookings || a.vendor.localeCompare(b.vendor));

  const totals = totalsFor(columns, rows);
  totals.score = null; // a sum of scores is meaningless
  const notes = [
    "Bookings / Vendor cost / Selling / Margin: bookings whose createdAt is in the range (excluding CANCELLED), attributed to the vendor of the lead's selected quotation, using that quotation's vendor cost, selling price and margin (ex GST, before coupon).",
    "Avg margin % = the mean of each booking's margin / selling price. Refunds = COMPLETED refunds by their own createdAt in the range, on bookings whose selected quotation is from that vendor.",
    "Vendor score = the weighted 1-5 score from the vendor's factor scores and the Admin vendor-scoring weights (same as Admin -> Vendors); it is not date-filtered.",
    `All active vendors in scope are listed, including those with no bookings in the range. Overall margin: ${percentOf(totals.margin ?? 0, totals.selling ?? 0) ?? "n/a"}% of selling.`,
  ];
  if (unattributed > 0) notes.push(`${unattributed} booking(s) in the range have no selected quotation and aren't attributed to any vendor.`);
  const capped = capRows(rows, notes);
  return { columns, rows: capped, totals, notes };
}

export const vendorMisReport: ReportDefinition = {
  key: "vendor-mis",
  title: "Vendor MIS",
  group: "mis",
  description: "Per vendor: services, bookings, vendor cost, selling, margin, average margin %, refunds and vendor score.",
  supportedFilters: ["serviceType", "countryId", "staffId", "vendorId"],
  run,
};
