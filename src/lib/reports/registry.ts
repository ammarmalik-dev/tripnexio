import type { ReportDefinition } from "./types";
import { FINANCE_REPORTS } from "./finance";
import { MIS_REPORTS } from "./mis";

/** P25 - every Finance / MIS report, by key. */
export const REPORTS: ReportDefinition[] = [...FINANCE_REPORTS, ...MIS_REPORTS];

export function getReport(key: string): ReportDefinition | undefined {
  return REPORTS.find((report) => report.key === key);
}
