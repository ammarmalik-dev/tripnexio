import { z } from "zod";
import { BookingStatus, LeadStatus, ServiceType } from "../../generated/prisma/enums";
import { REPORT_PAYMENT_STATUSES, type ReportFilterKey, type ReportFilters } from "./types";

/** Optional enum query value: "" / missing -> undefined. */
function optionalEnum<T extends Record<string, string>>(values: T) {
  return z
    .union([z.enum(values), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined));
}

/**
 * P25 - shared query-string parsing for /api/admin/reports/[key] and
 * /api/admin/reports/management. `from`/`to` are inclusive YYYY-MM-DD dates
 * (UTC); ReportFilters.to becomes the day AFTER `to` at 00:00 UTC (exclusive
 * bound). Default range = the last 30 days ending today; max range 3 years.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_REPORT_RANGE_DAYS = 3 * 366;
export const DEFAULT_REPORT_RANGE_DAYS = 30;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Not a valid date.");

const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => (value ? value : undefined));

export const reportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  serviceType: z
    .union([z.enum(ServiceType), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  countryId: optionalId,
  staffId: optionalId,
  vendorId: optionalId,
  // Admin handover §15 — sub-service ("SERVICE_TYPE:code"), lead / booking status, payment status.
  subService: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || /^[A-Z_]+:[a-z0-9_-]+$/.test(value), "Pick a sub-service from the list."),
  leadStatus: optionalEnum(LeadStatus),
  bookingStatus: optionalEnum(BookingStatus),
  paymentStatus: z
    .union([z.enum(REPORT_PAYMENT_STATUSES), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

export interface ParsedReportQuery {
  /** Inclusive YYYY-MM-DD strings, after defaults are applied. */
  from: string;
  to: string;
  filters: ReportFilters;
  format: "json" | "csv";
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcMidnight(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00Z`);
}

export type ParseReportQueryResult = { ok: true; value: ParsedReportQuery } | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export function parseReportQuery(searchParams: URLSearchParams): ParseReportQueryResult {
  const raw: Record<string, string> = {};
  for (const key of ["from", "to", "serviceType", "countryId", "staffId", "vendorId", "subService", "leadStatus", "bookingStatus", "paymentStatus", "format"]) {
    const value = searchParams.get(key);
    if (value !== null) raw[key] = value;
  }
  const parsed = reportQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid report filters.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const query = parsed.data;

  const todayIso = toIsoDate(new Date());
  const to = query.to ?? todayIso;
  const from = query.from ?? toIsoDate(new Date(utcMidnight(to).getTime() - (DEFAULT_REPORT_RANGE_DAYS - 1) * DAY_MS));

  const fromDate = utcMidnight(from);
  const toExclusive = new Date(utcMidnight(to).getTime() + DAY_MS);
  if (fromDate >= toExclusive) {
    return { ok: false, message: "The From date must be on or before the To date.", fieldErrors: { from: ["Must be on or before To."] } };
  }
  if ((toExclusive.getTime() - fromDate.getTime()) / DAY_MS > MAX_REPORT_RANGE_DAYS) {
    return { ok: false, message: "The date range can be at most 3 years.", fieldErrors: { from: ["Range too long (max 3 years)."] } };
  }

  return {
    ok: true,
    value: {
      from,
      to,
      format: query.format,
      filters: {
        from: fromDate,
        to: toExclusive,
        serviceType: query.serviceType,
        countryId: query.countryId,
        staffId: query.staffId,
        vendorId: query.vendorId,
        subService: query.subService,
        leadStatus: query.leadStatus,
        bookingStatus: query.bookingStatus,
        paymentStatus: query.paymentStatus,
      },
    },
  };
}

/** Drops every optional filter the report doesn't honour (date range always stays). */
export function restrictFilters(filters: ReportFilters, supported: ReportFilterKey[]): ReportFilters {
  const restricted: ReportFilters = { from: filters.from, to: filters.to };
  if (supported.includes("serviceType") && filters.serviceType) restricted.serviceType = filters.serviceType;
  if (supported.includes("countryId") && filters.countryId) restricted.countryId = filters.countryId;
  if (supported.includes("staffId") && filters.staffId) restricted.staffId = filters.staffId;
  if (supported.includes("vendorId") && filters.vendorId) restricted.vendorId = filters.vendorId;
  if (supported.includes("subService") && filters.subService) restricted.subService = filters.subService;
  if (supported.includes("leadStatus") && filters.leadStatus) restricted.leadStatus = filters.leadStatus;
  if (supported.includes("bookingStatus") && filters.bookingStatus) restricted.bookingStatus = filters.bookingStatus;
  if (supported.includes("paymentStatus") && filters.paymentStatus) restricted.paymentStatus = filters.paymentStatus;
  return restricted;
}

/** The previous period of equal length, immediately before `filters.from`. */
export function previousPeriod(filters: ReportFilters): ReportFilters {
  const length = filters.to.getTime() - filters.from.getTime();
  return { ...filters, from: new Date(filters.from.getTime() - length), to: new Date(filters.from.getTime()) };
}

/** Audit-note filter map: only the values that were actually applied. */
export function describeFilters(from: string, to: string, filters: ReportFilters): Record<string, string> {
  const described: Record<string, string> = { from, to };
  if (filters.serviceType) described.serviceType = filters.serviceType;
  if (filters.countryId) described.countryId = filters.countryId;
  if (filters.staffId) described.staffId = filters.staffId;
  if (filters.vendorId) described.vendorId = filters.vendorId;
  if (filters.subService) described.subService = filters.subService;
  if (filters.leadStatus) described.leadStatus = filters.leadStatus;
  if (filters.bookingStatus) described.bookingStatus = filters.bookingStatus;
  if (filters.paymentStatus) described.paymentStatus = filters.paymentStatus;
  return described;
}
