import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { csvExportResponse } from "@/lib/csv/export-guard";
import type { CsvColumn } from "@/lib/csv/to-csv";
import { getReport } from "@/lib/reports/registry";
import { describeFilters, parseReportQuery, restrictFilters } from "@/lib/reports/query";
import type { ReportCell } from "@/lib/reports/types";

interface RouteContext {
  params: Promise<{ key: string }>;
}

/**
 * P25 — runs one registered report. JSON by default; `format=csv` streams
 * the same rows through csvExportResponse() (row-capped + audited). Filters
 * the report doesn't declare in `supportedFilters` are silently dropped.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requirePermission("finance.manage");
    if (auth.error) return auth.error;

    const { key } = await params;
    const report = getReport(key);
    if (!report) return jsonError(404, "Report not found.");

    const parsed = parseReportQuery(new URL(request.url).searchParams);
    if (!parsed.ok) return jsonError(400, parsed.message, parsed.fieldErrors);
    const { from, to, format } = parsed.value;
    const filters = restrictFilters(parsed.value.filters, report.supportedFilters);

    const result = await report.run(filters);

    if (format === "csv") {
      const columns: CsvColumn<Record<string, ReportCell>>[] = result.columns.map((column) => ({
        key: column.key,
        header: column.label,
        // Money / numbers stay plain numbers (no currency symbol) so the CSV opens cleanly in a spreadsheet.
        value: (row) => row[column.key] ?? "",
      }));
      return csvExportResponse({
        exportName: `report-${report.key}`,
        filename: `${report.key}-${from}-${to}.csv`,
        rows: result.rows,
        columns,
        byUserId: auth.session.id,
        filters: describeFilters(from, to, filters),
      });
    }

    return jsonSuccess({
      key: report.key,
      title: report.title,
      group: report.group,
      description: report.description,
      supportedFilters: report.supportedFilters,
      from,
      to,
      ...result,
    });
  } catch (error) {
    console.error("[api/admin/reports/[key]] report failed", error);
    return jsonError(500, "Couldn't run this report. Please try again.");
  }
}
