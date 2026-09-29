import { db } from "../db";
import { writeAudit } from "../audit/log";
import { toCsv, type CsvColumn } from "./to-csv";
import { MAX_EXPORT_ROWS } from "./export-limits";

export { MAX_EXPORT_ROWS, EXPORT_QUERY_TAKE } from "./export-limits";

/**
 * P21 item 8 — every CSV export is row-capped and audited.
 *
 * Cap behaviour (applied identically by every export route): the route
 * queries `take: EXPORT_QUERY_TAKE` (cap + 1) so truncation is detectable
 * without a second COUNT query; `csvExportResponse()` then keeps only the
 * first MAX_EXPORT_ROWS rows and, when more existed, sets the
 * `X-Export-Truncated: true` response header (the CSV body itself stays a
 * clean, parser-friendly table — no comment/footer row). `X-Export-Row-Count`
 * is always set. Narrow the screen's filters to export the rest.
 */
export interface CsvExportInput<T> {
  /** Short machine name, e.g. "leads", "admin-bookings" — also the audit row's entityId. */
  exportName: string;
  /** Download filename, including `.csv`. */
  filename: string;
  /** Rows as queried with `take: EXPORT_QUERY_TAKE`. */
  rows: T[];
  columns: CsvColumn<T>[];
  byUserId: string;
  /** The filters/query params the export was run with (empty object = unfiltered). */
  filters: Record<string, string>;
}

/** Only the query params that were actually set — for the audit note. */
export function exportFiltersFromSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value.trim() !== "") filters[key] = value;
  }
  return filters;
}

export async function csvExportResponse<T>({ exportName, filename, rows, columns, byUserId, filters }: CsvExportInput<T>): Promise<Response> {
  const truncated = rows.length > MAX_EXPORT_ROWS;
  const exportedRows = truncated ? rows.slice(0, MAX_EXPORT_ROWS) : rows;
  const csv = toCsv(exportedRows, columns);

  const filterText = Object.keys(filters).length === 0 ? "none" : JSON.stringify(filters);
  await writeAudit(db, {
    entityType: "Export",
    entityId: exportName,
    action: "EXPORT",
    byUserId,
    note: `CSV export "${exportName}" — ${exportedRows.length} row(s)${truncated ? ` (truncated at the ${MAX_EXPORT_ROWS}-row cap)` : ""}; filters: ${filterText}`,
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Export-Row-Count": String(exportedRows.length),
  };
  if (truncated) headers["X-Export-Truncated"] = "true";

  return new Response(csv, { headers });
}
