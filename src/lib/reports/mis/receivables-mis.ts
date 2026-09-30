import { db } from "../../db";
import { paymentTotal } from "../../payments/totals";
import { bookingScopeWhere, paymentScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportColumn, ReportDefinition, ReportFilters, ReportResult } from "../types";
import type { ServiceType } from "../../../generated/prisma/enums";
import {
  ALL_SERVICE_TYPES,
  bucket,
  capRows,
  daysBetween,
  inChunks,
  loadBookingLeadIds,
  loadLeadMeta,
  loadSelectedQuotations,
  loadStaffNames,
  percentOf,
  serviceLabel,
  staffKeyOf,
  totalsFor,
} from "./shared";

const AGE_BUCKETS = [
  { key: "age0to7", label: "0-7 days", max: 7 },
  { key: "age8to15", label: "8-15 days", max: 15 },
  { key: "age16to30", label: "16-30 days", max: 30 },
  { key: "age31to60", label: "31-60 days", max: 60 },
  { key: "age60plus", label: "60+ days", max: Number.POSITIVE_INFINITY },
] as const;

type AgeKey = (typeof AGE_BUCKETS)[number]["key"];

interface ReceivableAcc {
  bookings: number;
  ages: Record<AgeKey, number>;
  outstanding: number;
  collected: number;
}

const emptyAcc = (): ReceivableAcc => ({
  bookings: 0,
  ages: { age0to7: 0, age8to15: 0, age16to30: 0, age31to60: 0, age60plus: 0 },
  outstanding: 0,
  collected: 0,
});

const columns: ReportColumn[] = [
  { key: "breakdown", label: "Breakdown", kind: "text" },
  { key: "name", label: "Service / Staff", kind: "text" },
  { key: "outstandingBookings", label: "Unpaid bookings", kind: "number" },
  ...AGE_BUCKETS.map((ageBucket): ReportColumn => ({ key: ageBucket.key, label: ageBucket.label, kind: "money" })),
  { key: "totalOutstanding", label: "Total outstanding", kind: "money" },
  { key: "collected", label: "Collected in range", kind: "money" },
  { key: "collectionPercent", label: "Collection %", kind: "percent" },
];

function ageKeyOf(days: number): AgeKey {
  // Whole days elapsed: 0-7 inclusive, then 8-15, ...
  const whole = Math.floor(days);
  for (const ageBucket of AGE_BUCKETS) if (whole <= ageBucket.max) return ageBucket.key;
  return "age60plus";
}

function toRow(breakdown: string, name: string, acc: ReceivableAcc): Record<string, ReportCell> {
  const row: Record<string, ReportCell> = { breakdown, name, outstandingBookings: acc.bookings };
  for (const ageBucket of AGE_BUCKETS) row[ageBucket.key] = round2(acc.ages[ageBucket.key]);
  row.totalOutstanding = round2(acc.outstanding);
  row.collected = round2(acc.collected);
  row.collectionPercent = percentOf(acc.collected, acc.collected + acc.outstanding);
  return row;
}

async function run(filters: ReportFilters): Promise<ReportResult> {
  const bookingScope = await bookingScopeWhere(filters);
  const paymentScope = await paymentScopeWhere(filters);
  const now = new Date();

  // Outstanding: active bookings created before the range end with no SUCCESS payment at all.
  const unpaid = await db.booking.findMany({
    where: {
      ...bookingScope,
      status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] },
      createdAt: { lt: filters.to },
      payments: { none: { status: "SUCCESS" } },
    },
    select: { id: true, leadId: true, createdAt: true },
  });
  const unpaidPayments = await inChunks(
    unpaid.map((booking) => booking.id),
    (chunk) =>
      db.payment.findMany({
        where: { bookingId: { in: chunk } },
        select: { bookingId: true, createdAt: true, amount: true, gstAmount: true, gatewayFee: true, couponDiscount: true },
        orderBy: { createdAt: "asc" },
      })
  );
  const latestPayment = new Map<string, (typeof unpaidPayments)[number]>();
  for (const payment of unpaidPayments) latestPayment.set(payment.bookingId, payment); // ascending -> last wins

  // Collected: SUCCESS payments with updatedAt in range (customer-payable total).
  const collectedPayments = await db.payment.findMany({
    where: { ...paymentScope, status: "SUCCESS", updatedAt: { gte: filters.from, lt: filters.to } },
    select: { bookingId: true, amount: true, gstAmount: true, gatewayFee: true, couponDiscount: true },
  });
  const collectedLeadByBooking = await loadBookingLeadIds(collectedPayments.map((payment) => payment.bookingId));

  const noPaymentLeadIds = unpaid.filter((booking) => !latestPayment.has(booking.id)).map((booking) => booking.leadId);
  const selected = await loadSelectedQuotations(noPaymentLeadIds);
  const leadMeta = await loadLeadMeta([...unpaid.map((booking) => booking.leadId), ...collectedLeadByBooking.values()]);

  const byService = new Map<ServiceType, ReceivableAcc>();
  const byStaff = new Map<string, ReceivableAcc>();
  const staffIds = new Set<string>();
  const accsFor = (leadId: string | undefined): ReceivableAcc[] => {
    const meta = leadId ? leadMeta.get(leadId) : undefined;
    if (!meta) return [];
    if (meta.assignedStaffId) staffIds.add(meta.assignedStaffId);
    return [bucket(byService, meta.serviceType, emptyAcc), bucket(byStaff, meta.assignedStaffId ?? "", emptyAcc)];
  };

  let estimated = 0;
  let noAmount = 0;
  for (const booking of unpaid) {
    const payment = latestPayment.get(booking.id);
    let amount: number;
    let since: Date;
    if (payment) {
      amount = paymentTotal(payment);
      since = payment.createdAt;
    } else {
      const quote = selected.get(booking.leadId);
      since = booking.createdAt;
      if (!quote) {
        noAmount += 1;
        amount = 0;
      } else {
        estimated += 1;
        amount = Math.max(0, quote.sellingPrice - quote.couponDiscount);
      }
    }
    const ageKey = ageKeyOf(Math.max(0, daysBetween(since, now)));
    for (const acc of accsFor(booking.leadId)) {
      acc.bookings += 1;
      acc.outstanding += amount;
      acc.ages[ageKey] += amount;
    }
  }
  for (const payment of collectedPayments) {
    const total = paymentTotal(payment);
    for (const acc of accsFor(collectedLeadByBooking.get(payment.bookingId))) acc.collected += total;
  }

  const staffNames = await loadStaffNames(staffIds);
  const serviceRows = ALL_SERVICE_TYPES.filter((serviceType) => byService.has(serviceType)).map((serviceType) =>
    toRow("By service", serviceLabel(serviceType), byService.get(serviceType) ?? emptyAcc())
  );
  const staffRows = [...byStaff.entries()]
    .map(([staffId, acc]) => ({ named: staffKeyOf(staffId || null, staffNames), acc }))
    .sort((a, b) => b.acc.outstanding - a.acc.outstanding || a.named.label.localeCompare(b.named.label))
    .map(({ named, acc }) => toRow("By staff", named.label, acc));

  const totals = totalsFor(columns, serviceRows);
  const notes = [
    "Outstanding: a snapshot as of now - PENDING/CONFIRMED/PROCESSING bookings created before the range end that have no SUCCESS payment. Amount = the customer-payable total of the booking's latest payment link (base - coupon + GST + gateway fee); a booking with no payment link yet uses its selected quotation's selling price minus coupon (ex GST).",
    "Ageing = whole days from the latest payment link's creation (or booking creation when none exists) until now, bucketed 0-7, 8-15, 16-30, 31-60, 60+.",
    "Collected in range: customer-payable total of SUCCESS payments whose updatedAt is in the range (no succeeded-at column exists). Collection % = collected / (collected + outstanding).",
    "Staff = the lead's current assignee. Totals are the sum of the By service rows only; By staff rows re-slice the same figures.",
    `Overall collection: ${percentOf(totals.collected ?? 0, (totals.collected ?? 0) + (totals.totalOutstanding ?? 0)) ?? "n/a"}%.`,
  ];
  if (estimated > 0) notes.push(`${estimated} unpaid booking(s) have no payment link yet, so their outstanding amount is the quotation price before GST/gateway fee.`);
  if (noAmount > 0) notes.push(`${noAmount} unpaid booking(s) have neither a payment link nor a selected quotation and are counted with a zero amount.`);
  const rows = capRows([...serviceRows, ...staffRows], notes);
  return { columns, rows, totals, notes };
}

export const receivablesMisReport: ReportDefinition = {
  key: "receivables-mis",
  title: "Receivables & Collection MIS",
  group: "mis",
  description: "Outstanding amounts on unpaid active bookings with ageing buckets, collections in range and collection %, per service and per staff.",
  supportedFilters: ["serviceType", "countryId", "staffId", "vendorId"],
  run,
};
