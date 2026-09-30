"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format-currency";
import type { ManagementLine, ManagementReport } from "@/lib/reports/management";
import type { ReportFilterKey } from "@/lib/reports/types";
import { ReportFilterBar, defaultReportFilters, reportQueryString, type ReportFilterValues } from "./ReportFilterBar";

type FetchState = "loading" | "success" | "error";

const SUPPORTED_FILTERS: ReportFilterKey[] = ["serviceType", "countryId", "staffId", "vendorId"];

/** Lines where a DEcrease is the good direction (costs). */
const LOWER_IS_BETTER = new Set<ManagementLine["key"]>(["cost", "refunds", "expenses"]);

function Delta({ line }: { line: ManagementLine }) {
  const diff = line.value - line.previousValue;
  if (Math.abs(diff) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-tertiary">
        <Minus className="h-3 w-3" aria-hidden="true" /> No change vs previous period
      </span>
    );
  }
  const up = diff > 0;
  const good = LOWER_IS_BETTER.has(line.key) ? !up : up;
  const pct = line.previousValue !== 0 ? (diff / Math.abs(line.previousValue)) * 100 : null;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", good ? "text-success" : "text-error")}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {pct === null ? "New vs previous period" : `${up ? "+" : ""}${pct.toLocaleString("en-IN", { maximumFractionDigits: 1 })}% vs previous period`}
    </span>
  );
}

interface WaterfallBar {
  line: ManagementLine;
  start: number;
  end: number;
}

/** Totals are levels drawn from 0; decreases float down from the running figure. Sales → Revenue is a new level, not a subtraction. */
function buildWaterfall(lines: ManagementLine[]): WaterfallBar[] {
  let running = 0;
  const bars: WaterfallBar[] = [];
  for (const line of lines) {
    if (line.kind === "total") {
      bars.push({ line, start: 0, end: line.value });
      running = line.value;
    } else if (line.kind === "decrease") {
      bars.push({ line, start: running, end: running - line.value });
      running -= line.value;
    }
  }
  return bars;
}

function Waterfall({ lines, currencyCode }: { lines: ManagementLine[]; currencyCode: string }) {
  const bars = buildWaterfall(lines);
  const points = bars.flatMap((bar) => [bar.start, bar.end]);
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const span = max - min || 1;
  const pos = (value: number) => ((value - min) / span) * 100;

  return (
    <div className="flex flex-col gap-2" role="img" aria-label="Waterfall from Sales to Net Profit">
      {bars.map(({ line, start, end }) => {
        const left = pos(Math.min(start, end));
        const width = Math.max(pos(Math.max(start, end)) - left, 0.5);
        const negativeLevel = line.kind === "total" && line.value < 0;
        return (
          <div key={line.key} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr_9rem]">
            <span className="text-xs font-medium text-ink-secondary">{line.label}</span>
            <div className="relative h-6 rounded bg-ink-primary/[0.04]">
              {min < 0 ? <div className="absolute inset-y-0 w-px bg-hairline" style={{ left: `${pos(0)}%` }} aria-hidden="true" /> : null}
              <div
                className={cn(
                  "absolute inset-y-1 rounded-sm",
                  line.kind === "decrease" ? "bg-error/70" : negativeLevel ? "bg-error" : "bg-accent"
                )}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            </div>
            <span className="col-start-2 text-right text-xs tabular-nums text-ink-primary sm:col-start-3">
              {line.kind === "decrease" ? "−" : ""}
              {formatCurrency(line.value, currencyCode)}
            </span>
          </div>
        );
      })}
      <p className="mt-1 text-xs text-ink-tertiary">
        Blue bars are levels (Sales, Revenue, Gross Profit, Net Profit); red bars are deductions from the figure above them. Sales and
        Revenue are measured on different bases (bookings created vs payments received), so Revenue is a new level, not Sales minus
        something.
      </p>
    </div>
  );
}

function KpiCard({ line, currencyCode }: { line: ManagementLine; currencyCode: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-4",
        line.key === "netProfit" ? "border-ink-accent/30 bg-ink-accent/5" : "border-hairline bg-surface-1"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">{line.label}</span>
      <span className={cn("text-xl font-semibold tabular-nums", line.value < 0 ? "text-error" : "text-ink-heading")}>
        {formatCurrency(line.value, currencyCode)}
      </span>
      <Delta line={line} />
      <span className="text-xs text-ink-tertiary">
        Previous: {formatCurrency(line.previousValue, currencyCode)}
        {line.detail ? ` · ${line.detail}` : ""}
      </span>
    </div>
  );
}

/** P25 (Locked Business Rules v2.0 §15) — management dashboard: KPI cards, waterfall, definitions. */
export function ManagementDashboard({ currencyCode }: { currencyCode: string }) {
  const [values, setValues] = useState<ReportFilterValues>(defaultReportFilters);
  const [state, setState] = useState<FetchState>("loading");
  const [report, setReport] = useState<ManagementReport | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  const query = reportQueryString(values, SUPPORTED_FILTERS);
  const rangeValid = Boolean(values.from && values.to && values.from <= values.to);

  useEffect(() => {
    if (!rangeValid) return;
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const data = await getJson<ManagementReport>(`/api/admin/reports/management?${query}`);
        if (cancelled) return;
        setReport(data);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the management dashboard. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [query, rangeValid, reloadNonce]);

  return (
    <div className="flex flex-col gap-6">
      <ReportFilterBar
        values={values}
        supportedFilters={SUPPORTED_FILTERS}
        onChange={setValues}
        onRefresh={() => setReloadNonce((current) => current + 1)}
      />

      {!rangeValid ? (
        <ErrorState title="Check the date range" description="Pick a From date on or before the To date." />
      ) : state === "loading" ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load the management dashboard"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : report ? (
        <>
          <p className="text-xs text-ink-tertiary">
            {report.from} to {report.to}, compared with {report.previousFrom} to {report.previousTo}.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.lines.map((line) => (
              <KpiCard key={line.key} line={line} currencyCode={currencyCode} />
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="text-sm font-semibold text-ink-heading">Sales to Net Profit</h2>
            <Waterfall lines={report.lines} currencyCode={currencyCode} />
            <p className="text-xs text-ink-tertiary">
              Gross collected in the period (incl. GST &amp; gateway fee): {formatCurrency(report.collected, currencyCode)} (previous:{" "}
              {formatCurrency(report.previousCollected, currencyCode)}).
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink-heading">How each figure is calculated</h2>
            </div>
            <dl className="flex flex-col gap-2">
              {report.lines.map((line) => (
                <div key={line.key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                  <dt className="shrink-0 text-xs font-semibold text-ink-primary sm:w-40">{line.label}</dt>
                  <dd className="text-xs text-ink-tertiary">{line.definition}</dd>
                </div>
              ))}
            </dl>
            <ul className="list-disc border-t border-hairline pl-5 pt-3 text-xs text-ink-tertiary">
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
