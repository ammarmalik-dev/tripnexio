import type { BookingStatus, LeadStatus, ServiceType } from "../../generated/prisma/enums";

/**
 * Admin handover §15 — a booking's payment position, for the "payment status" report filter:
 * PAID = has a successful payment, UNPAID = none yet, REFUNDED = has a completed refund (full or part).
 */
export const REPORT_PAYMENT_STATUSES = ["PAID", "UNPAID", "REFUNDED"] as const;
export type ReportPaymentStatus = (typeof REPORT_PAYMENT_STATUSES)[number];

export const REPORT_PAYMENT_STATUS_OPTIONS: { value: ReportPaymentStatus; label: string }[] = [
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "REFUNDED", label: "Refunded (full or part)" },
];

/**
 * P25 - the shared report framework (Locked Business Rules v2.0 §15).
 * Every Finance / MIS report is a ReportDefinition in the registry; one API
 * (/api/admin/reports/[key], JSON or audited CSV) and one page render any of
 * them, so a new report is just a new definition.
 */
export interface ReportFilters {
  /** Inclusive range start (00:00 of the first day). */
  from: Date;
  /** Exclusive range end (00:00 of the day after the last day). */
  to: Date;
  serviceType?: ServiceType;
  countryId?: string;
  /** Lead assignee (User id). */
  staffId?: string;
  /** Vendor of the lead's selected quotation. */
  vendorId?: string;
  /** Admin handover §15 — "SERVICE_TYPE:sub_service_code" (a SubService of that service). */
  subService?: string;
  /** Admin handover §15 — the lead's coarse status (lead-centric reports). */
  leadStatus?: LeadStatus;
  /** Admin handover §15 — the booking's coarse status. */
  bookingStatus?: BookingStatus;
  /** Admin handover §15 — the booking's payment position. */
  paymentStatus?: ReportPaymentStatus;
}

export type ReportFilterKey =
  | "serviceType"
  | "countryId"
  | "staffId"
  | "vendorId"
  | "subService"
  | "leadStatus"
  | "bookingStatus"
  | "paymentStatus";

export type ReportColumnKind = "text" | "money" | "number" | "percent" | "date";

export interface ReportColumn {
  key: string;
  label: string;
  kind: ReportColumnKind;
}

export type ReportCell = string | number | null;

export interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  /** Column key -> total, shown as a footer row (money/number columns only). */
  totals?: Record<string, number | null>;
  /** Short explanations of how figures are derived / caveats. */
  notes?: string[];
}

export interface ReportDefinition {
  key: string;
  title: string;
  group: "finance" | "mis";
  description: string;
  /** Which optional filters this report honours (date range is always applied). */
  supportedFilters: ReportFilterKey[];
  run(filters: ReportFilters): Promise<ReportResult>;
}

/** Every filter a booking / payment based report can honour (date range is always applied). */
export const SCOPE_FILTERS: ReportFilterKey[] = ["serviceType", "countryId", "staffId", "vendorId", "subService", "bookingStatus", "paymentStatus"];

/** Reports that count leads as well: the booking-scope filters plus lead status. */
export const LEAD_REPORT_FILTERS: ReportFilterKey[] = [...SCOPE_FILTERS, "leadStatus"];

/** Reports whose rows are unpaid by definition — a payment status filter would be meaningless. */
export const UNPAID_REPORT_FILTERS: ReportFilterKey[] = SCOPE_FILTERS.filter((key) => key !== "paymentStatus");
