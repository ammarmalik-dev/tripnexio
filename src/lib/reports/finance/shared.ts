import { db } from "../../db";
import type { BookingStatus, ServiceType } from "../../../generated/prisma/enums";
import { SERVICE_TYPE_LABELS } from "../../crm/labels";
import { getTimezoneOffsetMinutes } from "../../settings/system-config";
import { paymentScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportFilterKey, ReportFilters } from "../types";

/**
 * P25 - helpers shared by the Finance report definitions in this folder.
 * Every multi-table read is flat: one query per model, related rows fetched
 * with chunked `id in (...)` follow-ups, run one after another (the local dev
 * database drops connections under parallel bursts).
 */

/** Max rows a report returns. */
export const ROW_LIMIT = 10_000;
/** Max source rows a report reads before aggregating in memory. */
export const SOURCE_LIMIT = 50_000;
const IN_CHUNK = 5_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ALL_FILTERS: ReportFilterKey[] = ["serviceType", "countryId", "staffId", "vendorId"];
export const ALL_SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[];

type DecimalLike = { toString(): string } | null | undefined;

/** Prisma Decimal (or null) -> number. */
export function num(value: DecimalLike): number {
  return value == null ? 0 : Number(value.toString());
}

/** Percentage rounded to 2 dp, null when the denominator is 0. */
export function pct(numerator: number, denominator: number): number | null {
  return denominator ? round2((numerator / denominator) * 100) : null;
}

export function serviceLabel(serviceType: ServiceType): string {
  return SERVICE_TYPE_LABELS[serviceType];
}

export const PAYMENT_METHOD_LABELS: Record<"GATEWAY" | "BANK_TRANSFER", string> = {
  GATEWAY: "Payment gateway",
  BANK_TRANSFER: "Bank transfer",
};

export const PAYMENT_PURPOSE_LABELS: Record<"PRIMARY" | "EXTRA", string> = {
  PRIMARY: "Primary",
  EXTRA: "Extra",
};

/** Date-range where fragment for a timestamp column ([from, to)). */
export function inRange(filters: ReportFilters): { gte: Date; lt: Date } {
  return { gte: filters.from, lt: filters.to };
}

/** Sums the given keys over the rows (rounded to 2 dp). */
export function sumColumns(rows: Record<string, ReportCell>[], keys: string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const key of keys) {
    let total = 0;
    for (const row of rows) {
      const value = row[key];
      if (typeof value === "number") total += value;
    }
    totals[key] = round2(total);
  }
  return totals;
}

/** Trims rows to ROW_LIMIT, adding a note when anything was cut. */
export function capRows<T>(rows: T[], notes: string[]): T[] {
  if (rows.length <= ROW_LIMIT) return rows;
  notes.push(`Showing the first ${ROW_LIMIT.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} rows - narrow the date range or filters to see the rest.`);
  return rows.slice(0, ROW_LIMIT);
}

export function sourceLimitNote(count: number, notes: string[]): void {
  if (count >= SOURCE_LIMIT) {
    notes.push(`More than ${SOURCE_LIMIT.toLocaleString("en-IN")} source records matched; figures cover the first ${SOURCE_LIMIT.toLocaleString("en-IN")} only - narrow the date range.`);
  }
}

/** Runs an `in:` query over any number of ids in sequential chunks. */
export async function findInChunks<T>(ids: readonly string[], fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const unique = [...new Set(ids)];
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const part = await fetch(unique.slice(i, i + IN_CHUNK));
    for (const item of part) out.push(item);
  }
  return out;
}

export function isoDate(date: Date): string {
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Time buckets (business timezone from SystemConfig)
// ---------------------------------------------------------------------------

export type BucketUnit = "day" | "month";

export interface Buckets {
  unit: BucketUnit;
  offsetMinutes: number;
  /** Ordered bucket keys covering the whole range ("2026-09-01" or "2026-09"). */
  keys: string[];
  /** Key for a timestamp, in the business timezone. */
  keyOf(date: Date): string;
  /** Key for a @db.Date column value (already a calendar date at UTC midnight). */
  keyOfDateOnly(date: Date): string;
}

function localDayKey(date: Date, offsetMinutes: number): string {
  return new Date(date.getTime() + offsetMinutes * 60 * 1000).toISOString().slice(0, 10);
}

export async function businessOffsetMinutes(): Promise<number> {
  return getTimezoneOffsetMinutes(db);
}

export function buildBuckets(filters: ReportFilters, unit: BucketUnit, offsetMinutes: number): Buckets {
  const sliceTo = unit === "day" ? 10 : 7;
  const firstDay = localDayKey(filters.from, offsetMinutes);
  const lastDay = localDayKey(new Date(filters.to.getTime() - 1), offsetMinutes);
  const keys: string[] = [];
  let cursor = new Date(`${firstDay}T00:00:00.000Z`);
  const end = new Date(`${lastDay}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime() && keys.length < 5000) {
    const key = cursor.toISOString().slice(0, sliceTo);
    if (keys[keys.length - 1] !== key) keys.push(key);
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return {
    unit,
    offsetMinutes,
    keys,
    keyOf: (date) => localDayKey(date, offsetMinutes).slice(0, sliceTo),
    keyOfDateOnly: (date) => date.toISOString().slice(0, sliceTo),
  };
}

/** Number of calendar days the range spans. */
export function rangeDays(filters: ReportFilters): number {
  return Math.round((filters.to.getTime() - filters.from.getTime()) / DAY_MS);
}

/**
 * Bounds for a @db.Date column (Expense.date): the range's first and last
 * calendar days in the business timezone, as UTC-midnight dates.
 */
export function dateOnlyRange(filters: ReportFilters, offsetMinutes: number): { gte: Date; lt: Date } {
  const firstDay = localDayKey(filters.from, offsetMinutes);
  const lastDay = localDayKey(new Date(filters.to.getTime() - 1), offsetMinutes);
  return { gte: new Date(`${firstDay}T00:00:00.000Z`), lt: new Date(new Date(`${lastDay}T00:00:00.000Z`).getTime() + DAY_MS) };
}

// ---------------------------------------------------------------------------
// Booking context (booking -> lead -> customer / staff / selected quotation / vendor)
// ---------------------------------------------------------------------------

export interface BookingInfo {
  id: string;
  reference: string;
  status: BookingStatus;
  createdAt: Date;
  leadId: string;
  serviceType: ServiceType;
  customerName: string;
  staffName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  vendorCost: number;
  sellingPrice: number;
  quoteMargin: number;
}

/** Loads flat context for the given Booking row ids (6 sequential, chunked queries). */
export async function loadBookingInfo(bookingIds: readonly string[]): Promise<Map<string, BookingInfo>> {
  const result = new Map<string, BookingInfo>();
  if (bookingIds.length === 0) return result;

  const bookings = await findInChunks(bookingIds, (ids) =>
    db.booking.findMany({
      where: { id: { in: ids } },
      select: { id: true, bookingId: true, status: true, createdAt: true, leadId: true, customerId: true },
    })
  );
  const leads = await findInChunks(
    bookings.map((booking) => booking.leadId),
    (ids) => db.lead.findMany({ where: { id: { in: ids } }, select: { id: true, serviceType: true, assignedStaffId: true } })
  );
  const customers = await findInChunks(
    bookings.map((booking) => booking.customerId),
    (ids) => db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  );
  const quotations = await findInChunks(
    leads.map((lead) => lead.id),
    (ids) =>
      db.quotation.findMany({
        where: { leadId: { in: ids }, isSelected: true },
        select: { leadId: true, vendorId: true, vendorCost: true, sellingPrice: true, margin: true },
        orderBy: { updatedAt: "desc" },
      })
  );
  const staffIds = leads.map((lead) => lead.assignedStaffId).filter((id): id is string => id !== null);
  const staff = await findInChunks(staffIds, (ids) => db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }));
  const vendors = await findInChunks(
    quotations.map((quotation) => quotation.vendorId),
    (ids) => db.vendor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  );

  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const customerName = new Map(customers.map((customer) => [customer.id, customer.name]));
  const staffName = new Map(staff.map((user) => [user.id, user.name]));
  const vendorName = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const quoteByLead = new Map<string, (typeof quotations)[number]>();
  for (const quotation of quotations) {
    // Ordered newest first - keep the most recently updated selected quotation.
    if (!quoteByLead.has(quotation.leadId)) quoteByLead.set(quotation.leadId, quotation);
  }

  for (const booking of bookings) {
    const lead = leadById.get(booking.leadId);
    if (!lead) continue;
    const quote = quoteByLead.get(lead.id);
    result.set(booking.id, {
      id: booking.id,
      reference: booking.bookingId,
      status: booking.status,
      createdAt: booking.createdAt,
      leadId: lead.id,
      serviceType: lead.serviceType,
      customerName: customerName.get(booking.customerId) ?? "",
      staffName: lead.assignedStaffId ? staffName.get(lead.assignedStaffId) ?? null : null,
      vendorId: quote?.vendorId ?? null,
      vendorName: quote ? vendorName.get(quote.vendorId) ?? null : null,
      vendorCost: num(quote?.vendorCost),
      sellingPrice: num(quote?.sellingPrice),
      quoteMargin: num(quote?.margin),
    });
  }
  return result;
}

/** Map of User id -> name for the given ids. */
export async function loadUserNames(userIds: readonly (string | null)[]): Promise<Map<string, string>> {
  const ids = userIds.filter((id): id is string => typeof id === "string");
  const users = await findInChunks(ids, (chunk) => db.user.findMany({ where: { id: { in: chunk } }, select: { id: true, name: true } }));
  return new Map(users.map((user) => [user.id, user.name]));
}

// ---------------------------------------------------------------------------
// Recognised bookings (profit reports)
// ---------------------------------------------------------------------------

export interface RecognisedBooking extends BookingInfo {
  /** Timestamp of the booking's first SUCCESS payment (payment.updatedAt). */
  recognisedAt: Date;
  successfulPayments: number;
  /** Sum of (amount - couponDiscount) over the booking's SUCCESS payments up to the range end - ex GST and gateway fee. */
  revenue: number;
  profit: number;
}

export const RECOGNITION_NOTE =
  "A booking is counted in the period its FIRST successful payment falls in (payment.updatedAt of the SUCCESS row - Payment has no dedicated succeeded-at timestamp). Revenue = every SUCCESS payment on that booking up to the range end (primary + extra), amount minus coupon discount, excluding GST and gateway fee (pass-through). Vendor cost = the lead's selected quotation vendorCost, counted once per booking.";

/**
 * Bookings recognised in the range: those whose first SUCCESS payment's
 * updatedAt falls in [from, to). Scoped by the shared lead filters.
 */
export async function loadRecognisedBookings(filters: ReportFilters, notes: string[]): Promise<RecognisedBooking[]> {
  const scope = await paymentScopeWhere(filters);
  const candidates = await db.payment.findMany({
    where: { AND: [scope, { status: "SUCCESS", updatedAt: inRange(filters) }] },
    select: { bookingId: true },
    distinct: ["bookingId"],
    take: SOURCE_LIMIT,
  });
  sourceLimitNote(candidates.length, notes);

  const payments = await findInChunks(
    candidates.map((payment) => payment.bookingId),
    (ids) =>
      db.payment.findMany({
        where: { bookingId: { in: ids }, status: "SUCCESS", updatedAt: { lt: filters.to } },
        select: { bookingId: true, amount: true, couponDiscount: true, updatedAt: true },
      })
  );

  const perBooking = new Map<string, { first: Date; revenue: number; count: number }>();
  for (const payment of payments) {
    const revenue = Math.max(0, num(payment.amount) - num(payment.couponDiscount));
    const entry = perBooking.get(payment.bookingId);
    if (entry) {
      if (payment.updatedAt < entry.first) entry.first = payment.updatedAt;
      entry.revenue += revenue;
      entry.count += 1;
    } else {
      perBooking.set(payment.bookingId, { first: payment.updatedAt, revenue, count: 1 });
    }
  }

  const recognisedIds = [...perBooking.entries()].filter(([, entry]) => entry.first >= filters.from).map(([id]) => id);
  const info = await loadBookingInfo(recognisedIds);

  const rows: RecognisedBooking[] = [];
  for (const id of recognisedIds) {
    const booking = info.get(id);
    const entry = perBooking.get(id);
    if (!booking || !entry) continue;
    const revenue = round2(entry.revenue);
    rows.push({
      ...booking,
      recognisedAt: entry.first,
      successfulPayments: entry.count,
      revenue,
      profit: round2(revenue - booking.vendorCost),
    });
  }
  rows.sort((a, b) => a.recognisedAt.getTime() - b.recognisedAt.getTime());
  return rows;
}
