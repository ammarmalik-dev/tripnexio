import type { ReportDefinition } from "../types";
import { financialAdjustmentsReport } from "./adjustments";
import { collectionReport, expensesReport, financialSummaryReport, gatewayChargesReport, serviceRevenueReport } from "./cash";
import { profitMarginReport, profitPerBookingReport, profitPerServiceReport, vendorPaymentsReport } from "./profit";
import { monthlySalesReport, outstandingPaymentsReport } from "./sales";

/** P25 - Finance report definitions (registered in ../registry.ts). */
export const FINANCE_REPORTS: ReportDefinition[] = [
  vendorPaymentsReport,
  profitMarginReport,
  profitPerBookingReport,
  profitPerServiceReport,
  monthlySalesReport,
  outstandingPaymentsReport,
  expensesReport,
  gatewayChargesReport,
  collectionReport,
  serviceRevenueReport,
  financialSummaryReport,
  financialAdjustmentsReport,
];
