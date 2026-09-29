import { db } from "../db";
import { isExpiredNow } from "../quotations/sync-expiry";
import { requestedRouteFromDetails, shortPlace } from "../quotations/flight-quote";

const DAY_MS = 24 * 60 * 60 * 1000;
const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
const mean = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

function topCounts(values: (string | null)[], limit = 5): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export interface SpecialFareAnalytics {
  range: { from: string; to: string };
  enquiries: number;
  quotesCreated: number;
  quotesSent: number;
  quotesExpired: number;
  newQuoteRequests: number;
  bookings: number;
  paidBookings: number;
  conversionPercent: number | null;
  averageResponseMinutes: number | null;
  averageSellingPrice: number | null;
  /** Admin / finance only — null for everyone else. */
  averageMargin: number | null;
  topRoutes: { label: string; count: number }[];
  topDepartureAirports: { label: string; count: number }[];
  bestVendors: { vendor: string; paidBookings: number; revenue: number }[];
  staffConversion: { staff: string; enquiries: number; converted: number; conversionPercent: number }[];
  sevenDayConversion: { converted: number; percent: number | null };
  refunds: { count: number; amount: number; cancelledBookings: number };
}

/**
 * P16 — Flight_Special_Fare.md §25 Phase 1 analytics for enquiries created in
 * [from, to]. "Converted" = a booking with at least one successful payment.
 * "Quotes sent" = quotations created (each one notifies the customer). The
 * 7-day figure is enquiries converted within 7 days of the request.
 */
export async function getSpecialFareAnalytics(input: { from: Date; to: Date; includeMargin: boolean }): Promise<SpecialFareAnalytics> {
  const leads = await db.lead.findMany({
    where: { serviceType: "FLIGHT_SPECIAL_FARE", createdAt: { gte: input.from, lte: input.to } },
    select: {
      id: true,
      createdAt: true,
      details: true,
      assignedStaff: { select: { name: true } },
      quotations: {
        select: { id: true, createdAt: true, isSelected: true, isExpired: true, validityExpiresAt: true, sellingPrice: true, couponDiscount: true, margin: true, vendor: { select: { name: true } } },
      },
      bookings: {
        select: {
          id: true,
          status: true,
          payments: { select: { status: true, createdAt: true, updatedAt: true, refunds: { select: { status: true, refundAmount: true } } } },
        },
      },
    },
  });
  const leadIds = leads.map((lead) => lead.id);
  const newQuoteRequests = leadIds.length
    ? await db.auditTrail.count({ where: { entityType: "Lead", entityId: { in: leadIds }, action: "NEW_QUOTE_REQUESTED" } })
    : 0;

  let quotesCreated = 0;
  let quotesExpired = 0;
  const responseMinutes: number[] = [];
  const sellingPrices: number[] = [];
  const margins: number[] = [];
  const vendorStats = new Map<string, { paidBookings: number; revenue: number }>();
  const staffStats = new Map<string, { enquiries: number; converted: number }>();
  let bookings = 0;
  let paidLeads = 0;
  let convertedWithin7Days = 0;
  let refundCount = 0;
  let refundAmount = 0;
  let cancelledBookings = 0;

  for (const lead of leads) {
    quotesCreated += lead.quotations.length;
    quotesExpired += lead.quotations.filter((q) => !q.isSelected && isExpiredNow(q)).length;
    const firstQuote = lead.quotations.reduce<Date | null>((min, q) => (!min || q.createdAt < min ? q.createdAt : min), null);
    if (firstQuote) responseMinutes.push((firstQuote.getTime() - lead.createdAt.getTime()) / 60000);

    bookings += lead.bookings.length;
    const successPayments = lead.bookings.flatMap((b) => b.payments.filter((p) => p.status === "SUCCESS"));
    const converted = successPayments.length > 0;
    const staff = lead.assignedStaff?.name ?? "Unassigned";
    const stat = staffStats.get(staff) ?? { enquiries: 0, converted: 0 };
    stat.enquiries += 1;
    if (converted) {
      stat.converted += 1;
      paidLeads += 1;
      const firstPaidAt = successPayments.reduce((min, p) => (p.updatedAt < min ? p.updatedAt : min), successPayments[0].updatedAt);
      if (firstPaidAt.getTime() - lead.createdAt.getTime() <= 7 * DAY_MS) convertedWithin7Days += 1;
      const selected = lead.quotations.find((q) => q.isSelected);
      if (selected) {
        const price = Number(selected.sellingPrice) - Number(selected.couponDiscount ?? 0);
        sellingPrices.push(price);
        margins.push(Number(selected.margin));
        const vendor = selected.vendor?.name ?? "Unknown vendor";
        const v = vendorStats.get(vendor) ?? { paidBookings: 0, revenue: 0 };
        v.paidBookings += 1;
        v.revenue += price;
        vendorStats.set(vendor, v);
      }
    }
    staffStats.set(staff, stat);

    for (const booking of lead.bookings) {
      if (booking.status === "CANCELLED" || booking.status === "REFUNDED") cancelledBookings += 1;
      for (const payment of booking.payments) {
        for (const refund of payment.refunds) {
          if (refund.status === "REJECTED") continue;
          refundCount += 1;
          refundAmount += Number(refund.refundAmount);
        }
      }
    }
  }

  const avgResponse = mean(responseMinutes);
  const avgPrice = mean(sellingPrices);
  const avgMargin = mean(margins);
  return {
    range: { from: input.from.toISOString(), to: input.to.toISOString() },
    enquiries: leads.length,
    quotesCreated,
    quotesSent: quotesCreated,
    quotesExpired,
    newQuoteRequests,
    bookings,
    paidBookings: paidLeads,
    conversionPercent: leads.length ? round((paidLeads / leads.length) * 100, 1) : null,
    averageResponseMinutes: avgResponse === null ? null : round(avgResponse, 1),
    averageSellingPrice: avgPrice === null ? null : round(avgPrice),
    averageMargin: input.includeMargin && avgMargin !== null ? round(avgMargin) : null,
    topRoutes: topCounts(leads.map((lead) => requestedRouteFromDetails(lead.details))),
    topDepartureAirports: topCounts(leads.map((lead) => shortPlace((lead.details as Record<string, unknown> | null)?.origin))),
    bestVendors: [...vendorStats.entries()]
      .map(([vendor, v]) => ({ vendor, paidBookings: v.paidBookings, revenue: round(v.revenue) }))
      .sort((a, b) => b.paidBookings - a.paidBookings || b.revenue - a.revenue)
      .slice(0, 5),
    staffConversion: [...staffStats.entries()]
      .map(([staff, s]) => ({ staff, enquiries: s.enquiries, converted: s.converted, conversionPercent: s.enquiries ? round((s.converted / s.enquiries) * 100, 1) : 0 }))
      .sort((a, b) => b.converted - a.converted || b.enquiries - a.enquiries),
    sevenDayConversion: { converted: convertedWithin7Days, percent: leads.length ? round((convertedWithin7Days / leads.length) * 100, 1) : null },
    refunds: { count: refundCount, amount: round(refundAmount), cancelledBookings },
  };
}
