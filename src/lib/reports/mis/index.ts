import type { ReportDefinition } from "../types";
import { salesMisReport } from "./sales-mis";
import { revenueMisReport } from "./revenue-mis";
import { profitMisReport } from "./profit-mis";
import { operationsMisReport } from "./operations-mis";
import { receivablesMisReport } from "./receivables-mis";
import { vendorMisReport } from "./vendor-mis";

/** P25 - MIS report definitions (registered in ../registry.ts). */
export const MIS_REPORTS: ReportDefinition[] = [
  salesMisReport,
  revenueMisReport,
  profitMisReport,
  operationsMisReport,
  receivablesMisReport,
  vendorMisReport,
];
