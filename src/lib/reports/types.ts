import type { ServiceType } from "../../generated/prisma/enums";

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
}

export type ReportFilterKey = "serviceType" | "countryId" | "staffId" | "vendorId";

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
