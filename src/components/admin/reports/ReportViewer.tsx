"use client";

import { useEffect, useState } from "react";
import { Download, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button, buttonBaseClass, buttonSizeClass, buttonVariantClass } from "@/components/ui/Button";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format-currency";
import type { ReportCell, ReportColumn, ReportColumnKind, ReportFilterKey, ReportResult } from "@/lib/reports/types";
import { ReportFilterBar, defaultReportFilters, reportQueryString, type ReportFilterValues } from "./ReportFilterBar";

type FetchState = "loading" | "success" | "error";

export function formatReportCell(value: ReportCell | undefined, kind: ReportColumnKind, currencyCode: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    switch (kind) {
      case "money":
        return formatCurrency(value, currencyCode);
      case "percent":
        return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
      case "number":
        return value.toLocaleString("en-IN");
      default:
        return String(value);
    }
  }
  if (kind === "date" && value.length > 10 && !Number.isNaN(Date.parse(value))) return value.slice(0, 10);
  return value;
}

function isNumericKind(kind: ReportColumnKind): boolean {
  return kind === "money" || kind === "number" || kind === "percent";
}

interface ReportViewerProps {
  reportKey: string;
  supportedFilters: ReportFilterKey[];
  currencyCode: string;
}

/** P25 — generic viewer for any registered report: filter bar, table with totals footer, notes, CSV export. */
export function ReportViewer({ reportKey, supportedFilters, currencyCode }: ReportViewerProps) {
  const [values, setValues] = useState<ReportFilterValues>(defaultReportFilters);
  const [state, setState] = useState<FetchState>("loading");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  const query = reportQueryString(values, supportedFilters);
  const rangeValid = Boolean(values.from && values.to && values.from <= values.to);

  useEffect(() => {
    if (!rangeValid) return;
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const data = await getJson<ReportResult>(`/api/admin/reports/${encodeURIComponent(reportKey)}?${query}`);
        if (cancelled) return;
        setResult(data);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this report. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reportKey, query, rangeValid, reloadNonce]);

  const csvHref = `/api/admin/reports/${encodeURIComponent(reportKey)}?${query}&format=csv`;
  const hasRows = state === "success" && result !== null && result.rows.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <ReportFilterBar
        values={values}
        supportedFilters={supportedFilters}
        onChange={setValues}
        onRefresh={() => setReloadNonce((current) => current + 1)}
        actions={
          hasRows && rangeValid ? (
            // A plain anchor (not next/link) so the browser performs a normal file download of the attachment response.
            <a href={csvHref} download className={cn(buttonBaseClass, buttonVariantClass.primary, buttonSizeClass.sm)}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </a>
          ) : null
        }
      />

      {!rangeValid ? (
        <ErrorState title="Check the date range" description="Pick a From date on or before the To date." />
      ) : state === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading report">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load this report"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : result ? (
        <>
          {result.rows.length === 0 ? (
            <EmptyState title="No data for these filters" description="Try a wider date range or clear some filters." />
          ) : (
            <ReportTable columns={result.columns} rows={result.rows} totals={result.totals} currencyCode={currencyCode} />
          )}
          {result.notes && result.notes.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-5">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink-heading">Notes</h2>
              </div>
              <ul className="list-disc pl-5 text-xs text-ink-tertiary">
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface ReportTableProps {
  columns: ReportColumn[];
  rows: Record<string, ReportCell>[];
  totals?: Record<string, number | null>;
  currencyCode: string;
}

function ReportTable({ columns, rows, totals, currencyCode }: ReportTableProps) {
  const showTotals = totals !== undefined && Object.keys(totals).length > 0;
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="border-b border-hairline text-xs uppercase tracking-wide text-ink-tertiary">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn("whitespace-nowrap px-4 py-3 font-medium", isNumericKind(column.kind) && "text-right")}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-hairline last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("whitespace-nowrap px-4 py-2.5 text-ink-primary", isNumericKind(column.kind) && "text-right tabular-nums")}
                >
                  {formatReportCell(row[column.key], column.kind, currencyCode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {showTotals ? (
          <tfoot className="border-t-2 border-hairline bg-surface-2 font-semibold text-ink-heading">
            <tr>
              {columns.map((column, index) => {
                const total = totals?.[column.key];
                return (
                  <td key={column.key} className={cn("whitespace-nowrap px-4 py-3", isNumericKind(column.kind) && "text-right tabular-nums")}>
                    {typeof total === "number" ? formatReportCell(total, column.kind, currencyCode) : index === 0 ? "Total" : ""}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
