import { db } from "../../db";
import { SERVICE_TYPE_LABELS } from "../../crm/labels";
import { round2 } from "../scope";
import type { PaymentPurpose, ServiceType } from "../../../generated/prisma/enums";
import type { Prisma } from "../../../generated/prisma/client";
import type { ReportCell, ReportColumn } from "../types";

/**
 * P25 - small helpers shared by the MIS report definitions. Every lookup is a
 * flat `select` over an `in:` list, chunked and run sequentially (the local
 * dev Postgres drops connections under parallel bursts / deep includes).
 */

export const MAX_ROWS = 10_000;
const IN_CHUNK = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ALL_SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[];

export const UNASSIGNED_KEY = "unassigned";
export const UNASSIGNED_LABEL = "Unassigned";

type DecimalLike = { toString(): string } | null | undefined;

/** Prisma Decimal (or null) -> number. */
export function num(value: DecimalLike): number {
  return value === null || value === undefined ? 0 : Number(value.toString());
}

/** part / whole as a 0-100 percentage (2 dp); null when whole is 0. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? round2((part / whole) * 100) : null;
}

export function serviceLabel(serviceType: ServiceType): string {
  return SERVICE_TYPE_LABELS[serviceType];
}

export function daysBetween(earlier: Date, later: Date): number {
  return (later.getTime() - earlier.getTime()) / DAY_MS;
}

/** Runs `fetch` over `ids` in chunks, one chunk after another. */
export async function inChunks<T>(ids: Iterable<string>, fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const unique = [...new Set(ids)];
  const results: T[] = [];
  for (let index = 0; index < unique.length; index += IN_CHUNK) {
    const part = await fetch(unique.slice(index, index + IN_CHUNK));
    results.push(...part);
  }
  return results;
}

export interface LeadMeta {
  serviceType: ServiceType;
  assignedStaffId: string | null;
}

export async function loadLeadMeta(leadIds: Iterable<string>): Promise<Map<string, LeadMeta>> {
  const rows = await inChunks(leadIds, (chunk) =>
    db.lead.findMany({ where: { id: { in: chunk } }, select: { id: true, serviceType: true, assignedStaffId: true } })
  );
  return new Map(rows.map((row) => [row.id, { serviceType: row.serviceType, assignedStaffId: row.assignedStaffId }]));
}

/** booking id -> lead id */
export async function loadBookingLeadIds(bookingIds: Iterable<string>): Promise<Map<string, string>> {
  const rows = await inChunks(bookingIds, (chunk) =>
    db.booking.findMany({ where: { id: { in: chunk } }, select: { id: true, leadId: true } })
  );
  return new Map(rows.map((row) => [row.id, row.leadId]));
}

/** payment id -> booking id */
export async function loadPaymentBookingIds(paymentIds: Iterable<string>): Promise<Map<string, string>> {
  const rows = await inChunks(paymentIds, (chunk) =>
    db.payment.findMany({ where: { id: { in: chunk } }, select: { id: true, bookingId: true } })
  );
  return new Map(rows.map((row) => [row.id, row.bookingId]));
}

export interface SelectedQuote {
  vendorId: string;
  vendorCost: number;
  sellingPrice: number;
  margin: number;
  couponDiscount: number;
}

/** lead id -> that lead's selected quotation. */
export async function loadSelectedQuotations(leadIds: Iterable<string>): Promise<Map<string, SelectedQuote>> {
  const rows = await inChunks(leadIds, (chunk) =>
    db.quotation.findMany({
      where: { leadId: { in: chunk }, isSelected: true },
      select: { leadId: true, vendorId: true, vendorCost: true, sellingPrice: true, margin: true, couponDiscount: true },
      orderBy: { updatedAt: "desc" },
    })
  );
  const map = new Map<string, SelectedQuote>();
  for (const row of rows) {
    if (map.has(row.leadId)) continue; // one selected quotation per lead; keep the newest if data ever disagrees
    map.set(row.leadId, {
      vendorId: row.vendorId,
      vendorCost: num(row.vendorCost),
      sellingPrice: num(row.sellingPrice),
      margin: num(row.margin),
      couponDiscount: num(row.couponDiscount),
    });
  }
  return map;
}

export async function loadStaffNames(userIds: Iterable<string>): Promise<Map<string, string>> {
  const rows = await inChunks(userIds, (chunk) => db.user.findMany({ where: { id: { in: chunk } }, select: { id: true, name: true } }));
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Calendar month key (UTC) - "YYYY-MM". */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Every month key touched by [from, to). */
export function monthsInRange(from: Date, to: Date): string[] {
  const last = new Date(Math.max(from.getTime(), to.getTime() - 1));
  const keys: string[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  while (year < last.getUTCFullYear() || (year === last.getUTCFullYear() && month <= last.getUTCMonth())) {
    keys.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
    if (keys.length > 600) break; // guard against an absurd range
  }
  return keys;
}

/** The month key before `key`. */
export function previousMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

/** Sums every money/number column over `rows` (money rounded to 2 dp). */
export function totalsFor(columns: ReportColumn[], rows: Record<string, ReportCell>[]): Record<string, number | null> {
  const totals: Record<string, number | null> = {};
  for (const column of columns) {
    if (column.kind !== "money" && column.kind !== "number") continue;
    let sum = 0;
    for (const row of rows) {
      const value = row[column.key];
      if (typeof value === "number") sum += value;
    }
    totals[column.key] = column.kind === "money" ? round2(sum) : sum;
  }
  return totals;
}

/** Caps rows at MAX_ROWS, adding a note when anything was cut. */
export function capRows(rows: Record<string, ReportCell>[], notes: string[]): Record<string, ReportCell>[] {
  if (rows.length <= MAX_ROWS) return rows;
  notes.push(`Only the first ${MAX_ROWS.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} rows are shown; narrow the filters to see the rest.`);
  return rows.slice(0, MAX_ROWS);
}

export interface NamedKey {
  key: string;
  label: string;
}

export function staffKeyOf(staffId: string | null, names: Map<string, string>): NamedKey {
  if (!staffId) return { key: UNASSIGNED_KEY, label: UNASSIGNED_LABEL };
  return { key: staffId, label: names.get(staffId) ?? "(Unknown staff)" };
}

/** Get-or-create a mutable accumulator in a map. */
export function bucket<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

export interface PaymentFact {
  paymentId: string;
  bookingId: string;
  month: string;
  serviceType: ServiceType;
  purpose: PaymentPurpose;
  /** amount - couponDiscount: the taxable value (includes any Protection Plan, excludes GST and gateway fee). */
  revenueExGst: number;
  gst: number;
  gatewayFee: number;
  leadId: string;
}

export interface RefundFact {
  month: string;
  serviceType: ServiceType;
  leadId: string;
  amount: number;
}

/**
 * SUCCESS payments with updatedAt in range (Payment has no succeeded-at
 * column - same convention as the Revenue/P&L reports) and COMPLETED refunds
 * with createdAt in range, both within the lead scope, with service + month.
 */
export async function loadRevenueFacts(
  from: Date,
  to: Date,
  paymentScope: Prisma.PaymentWhereInput
): Promise<{ payments: PaymentFact[]; refunds: RefundFact[] }> {
  const payments = await db.payment.findMany({
    where: { ...paymentScope, status: "SUCCESS", updatedAt: { gte: from, lt: to } },
    select: { id: true, bookingId: true, amount: true, couponDiscount: true, gstAmount: true, gatewayFee: true, purpose: true, updatedAt: true },
  });
  const refunds = await db.refund.findMany({
    where: { status: "COMPLETED", createdAt: { gte: from, lt: to }, payment: paymentScope },
    select: { paymentId: true, refundAmount: true, createdAt: true },
  });

  const refundBookingByPayment = await loadPaymentBookingIds(refunds.map((refund) => refund.paymentId));
  const bookingIds = new Set<string>(payments.map((payment) => payment.bookingId));
  for (const bookingId of refundBookingByPayment.values()) bookingIds.add(bookingId);
  const leadByBooking = await loadBookingLeadIds(bookingIds);
  const leadMeta = await loadLeadMeta(leadByBooking.values());

  const paymentFacts: PaymentFact[] = [];
  for (const payment of payments) {
    const leadId = leadByBooking.get(payment.bookingId);
    const meta = leadId ? leadMeta.get(leadId) : undefined;
    if (!leadId || !meta) continue;
    paymentFacts.push({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      month: monthKey(payment.updatedAt),
      serviceType: meta.serviceType,
      purpose: payment.purpose,
      revenueExGst: Math.max(0, num(payment.amount) - num(payment.couponDiscount)),
      gst: num(payment.gstAmount),
      gatewayFee: num(payment.gatewayFee),
      leadId,
    });
  }

  const refundFacts: RefundFact[] = [];
  for (const refund of refunds) {
    const bookingId = refundBookingByPayment.get(refund.paymentId);
    const leadId = bookingId ? leadByBooking.get(bookingId) : undefined;
    const meta = leadId ? leadMeta.get(leadId) : undefined;
    if (!leadId || !meta) continue;
    refundFacts.push({ month: monthKey(refund.createdAt), serviceType: meta.serviceType, leadId, amount: num(refund.refundAmount) });
  }

  return { payments: paymentFacts, refunds: refundFacts };
}
