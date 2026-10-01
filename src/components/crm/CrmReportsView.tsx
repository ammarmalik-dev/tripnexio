"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { DateRangeFilter } from "@/components/crm/DateRangeFilter";
import { useDateRangeFilter } from "@/components/crm/useDateRangeFilter";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { getJson, ApiError } from "@/lib/api/client";
import type { ConversionRow, CountAmountRow, CrmReports } from "@/lib/crm/reports";

const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-4">
      <span className="text-xs text-ink-tertiary">{label}</span>
      <span className="text-xl font-semibold text-ink-heading">{value}</span>
      {hint ? <span className="text-xs text-ink-tertiary">{hint}</span> : null}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div>
        <h2 className="text-sm font-semibold text-ink-heading">{title}</h2>
        {description ? <p className="text-xs text-ink-tertiary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Read-only report table. Paginates (10 rows first) once it has more rows
 * than a single default page, so short breakdowns stay uncluttered.
 */
function ReportTable({ headers, rows, empty, noun = "row" }: { headers: string[]; rows: ReactNode[][]; empty: string; noun?: string }) {
  const { pageItems, paginationProps } = useClientPagination(rows);
  if (rows.length === 0) return <p className="text-sm text-ink-tertiary">{empty}</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs uppercase tracking-wide text-ink-tertiary">
              {headers.map((header, i) => (
                <th key={header} scope="col" className={i === 0 ? "py-2 pr-3 font-medium" : "py-2 pl-3 text-right font-medium"}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((cells, rowIndex) => (
              <tr key={rowIndex} className="border-b border-hairline last:border-0 hover:bg-ink-primary/[0.02]">
                {cells.map((cell, i) => (
                  <td key={i} className={i === 0 ? "py-2 pr-3 text-ink-secondary" : "py-2 pl-3 text-right font-medium tabular-nums text-ink-primary"}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > DEFAULT_PAGE_SIZE ? <ListPagination noun={noun} {...paginationProps} /> : null}
    </div>
  );
}

const countAmountRows = (rows: CountAmountRow[], withAmount: boolean): ReactNode[][] =>
  rows.map((row) => (withAmount ? [row.label, String(row.count), money(row.amount)] : [row.label, String(row.count)]));

const conversionRows = (rows: ConversionRow[]): ReactNode[][] =>
  rows.map((row) => [row.label, String(row.leads), String(row.qualified), String(row.converted), pct(row.conversionPercent)]);

function isEmptyReport(data: CrmReports): boolean {
  return (
    data.kpis.leads === 0 &&
    data.kpis.bookings === 0 &&
    data.kpis.successfulPayments === 0 &&
    data.kpis.refundCount === 0 &&
    data.staffWorkload.length === 0
  );
}

/** P22 item 3 — CRM.md §29 staff Reports. */
export function CrmReportsView() {
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear } = useDateRangeFilter();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [data, setData] = useState<CrmReports | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      try {
        const result = await getJson<CrmReports>(`/api/crm/reports?${params.toString()}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the reports.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, reloadNonce]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <DateRangeFilter
          idPrefix="crm-reports"
          dateFrom={dateFrom}
          dateTo={dateTo}
          onPreset={applyPreset}
          onCustomFrom={applyCustomFrom}
          onCustomTo={applyCustomTo}
          onClear={clear}
        />
        {!dateFrom && !dateTo ? <p className="text-xs text-ink-tertiary">Showing the last 30 days by default.</p> : null}
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading reports">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state === "error" || !data ? (
        <ErrorState
          title="Couldn't load the reports"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : isEmptyReport(data) ? (
        <EmptyState title="Nothing to report in this period" description="No leads, bookings, payments, refunds or open work found. Try a wider date range." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Leads" value={String(data.kpis.leads)} hint={`${data.kpis.qualifiedLeads} qualified or later`} />
            <Stat label="Bookings" value={String(data.kpis.bookings)} hint={`${data.kpis.completedBookings} completed · ${data.kpis.cancelledBookings} cancelled`} />
            <Stat label="Conversion" value={pct(data.kpis.conversionPercent)} hint={`${data.kpis.convertedLeads} converted ÷ leads`} />
            <Stat label="Revenue collected" value={money(data.kpis.revenueCollected)} hint={`${data.kpis.successfulPayments} successful payments`} />
            <Stat label="Refunds" value={`${data.kpis.refundCount} · ${money(data.kpis.refundAmount)}`} hint="Raised in period" />
            {data.finance ? (
              <>
                <Stat label="Vendor cost (internal)" value={money(data.finance.vendorCost)} hint="Selected quotes on period bookings" />
                <Stat label="Margin (internal)" value={money(data.finance.margin)} hint={`On ${money(data.finance.sellingPrice)} sold`} />
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Section title="Bookings by service" description="Bookings created in the period.">
              <ReportTable headers={["Service", "Bookings"]} rows={countAmountRows(data.bookingsByService, false)} empty="No bookings in this period." />
            </Section>
            <Section title="Bookings by status" description="Current status of bookings created in the period.">
              <ReportTable headers={["Status", "Bookings"]} rows={countAmountRows(data.bookingsByStatus, false)} empty="No bookings in this period." />
            </Section>
            <Section title="Lead conversion by service" description="Qualified = at or past Qualified. Converted = lead status Converted.">
              <ReportTable headers={["Service", "Leads", "Qualified", "Converted", "Rate"]} rows={conversionRows(data.conversionByService)} empty="No leads in this period." />
            </Section>
            <Section title="Lead conversion by source">
              <ReportTable noun="source" headers={["Source", "Leads", "Qualified", "Converted", "Rate"]} rows={conversionRows(data.conversionBySource)} empty="No leads in this period." />
            </Section>
            <Section title="Service mix" description="Share of period bookings and of revenue collected, per service.">
              <ReportTable
                headers={["Service", "Bookings", "Booking share", "Revenue", "Revenue share"]}
                rows={data.serviceMix.map((row) => [row.label, String(row.bookings), `${row.bookingSharePercent}%`, money(row.revenue), `${row.revenueSharePercent}%`])}
                empty="No bookings or revenue in this period."
              />
            </Section>
            <Section title="Refund summary" description={`${data.refunds.count} raised · ${money(data.refunds.amount)} total · ${money(data.refunds.completedAmount)} completed`}>
              <div className="flex flex-col gap-4">
                <ReportTable headers={["Status", "Count", "Amount"]} rows={countAmountRows(data.refunds.byStatus, true)} empty="No refunds raised in this period." />
                {data.refunds.byService.length > 0 ? (
                  <ReportTable headers={["Service", "Count", "Amount"]} rows={countAmountRows(data.refunds.byService, true)} empty="" />
                ) : null}
              </div>
            </Section>
          </div>

          <Section title="Staff workload" description="Live snapshot of open work (not period-filtered). Bookings and PAX are attributed via the booking's lead assignee.">
            <ReportTable
              headers={["Staff", "Open leads", "Open bookings", "PAX", "Open tasks"]}
              noun="staff member"
              rows={data.staffWorkload.map((row) => [
                row.active ? row.name : `${row.name} (inactive)`,
                String(row.openLeads),
                String(row.openBookings),
                String(row.pax),
                String(row.openTasks),
              ])}
              empty="No open work is assigned to anyone."
            />
          </Section>

          {data.finance ? (
            <Section title="Vendor cost & margin by service (internal)" description="Admin/finance only. Selected quotation of each non-cancelled booking created in the period.">
              <ReportTable
                headers={["Service", "Bookings", "Sold", "Vendor cost", "Margin"]}
                rows={data.finance.byService.map((row) => [row.label, String(row.bookings), money(row.sellingPrice), money(row.vendorCost), money(row.margin)])}
                empty="No bookings with a selected quotation in this period."
              />
            </Section>
          ) : null}

          <p className="text-xs text-ink-tertiary">
            Leads and bookings are counted by creation date; revenue by successful payments updated in the period; refunds by the date they were raised.
          </p>
        </>
      )}
    </div>
  );
}
