"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { getJson, ApiError } from "@/lib/api/client";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { cn } from "@/lib/cn";
import type { DelayAnalysis, DelayBreakdownRow, DelayType } from "@/lib/crm/delays";

type StatusFilter = "ALL" | "OPEN" | "RESOLVED";

/** "3.5 h" under two days, otherwise "2.1 d". */
function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 48) return `${hours.toLocaleString("en-IN", { maximumFractionDigits: 1 })} h`;
  return `${(Math.round((hours / 24) * 10) / 10).toLocaleString("en-IN")} d`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-4">
      <span className="text-xs text-ink-tertiary">{label}</span>
      <span className="text-xl font-semibold text-ink-heading">{value}</span>
      {hint ? <span className="text-xs text-ink-tertiary">{hint}</span> : null}
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: DelayBreakdownRow[] }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
      <h2 className="text-sm font-semibold text-ink-heading">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-tertiary">No delays.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-tertiary">
              <th className="py-1 pr-2 font-medium">Name</th>
              <th className="py-1 pr-2 text-right font-medium">Open</th>
              <th className="py-1 pr-2 text-right font-medium">Resolved</th>
              <th className="py-1 text-right font-medium">Avg delay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-hairline">
                <td className="py-1.5 pr-2 text-ink-secondary">{row.label}</td>
                <td className="py-1.5 pr-2 text-right font-medium text-ink-primary">{row.open}</td>
                <td className="py-1.5 pr-2 text-right text-ink-secondary">{row.resolved}</td>
                <td className="py-1.5 text-right text-ink-secondary">{formatDuration(row.averageDelayHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** P21 item 9 — CRM.md §30 Delay Analysis. Backed by GET /api/crm/delays (src/lib/crm/delays.ts). */
export function DelayAnalysisView() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [data, setData] = useState<DelayAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<DelayType | "">("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<DelayAnalysis>("/api/crm/delays");
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the delay analysis.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const visibleRecords = useMemo(() => {
    if (!data) return [];
    return data.records.filter(
      (record) =>
        (statusFilter === "ALL" || record.status === statusFilter) &&
        (serviceFilter === "" || record.serviceType === serviceFilter) &&
        (reasonFilter === "" || record.type === reasonFilter)
    );
  }, [data, statusFilter, serviceFilter, reasonFilter]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <ErrorState
        title="Couldn't load the delay analysis"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const selectClass = cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm");

  return (
    <div className="flex flex-col gap-5">
      {data.unconfiguredServices.length > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-hairline bg-surface-1 p-4 text-sm text-ink-secondary">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden="true" />
          <p>
            Not included — no SLA configured in Admin → Timelines / SLA:{" "}
            <span className="font-medium text-ink-primary">{data.unconfiguredServices.map((service) => service.serviceLabel).join(", ")}</span>.
          </p>
        </div>
      ) : null}

      {data.truncated ? (
        <p className="text-xs text-warning">Very large backlog — figures cover only the most recent 2,000 bookings/documents per delay type.</p>
      ) : null}

      {data.configuredServices.length === 0 ? (
        <EmptyState
          title="No SLAs configured"
          description="Set an expected completion time or document verification time per service in Admin → Timelines / SLA to start tracking delays."
        />
      ) : data.totals.total === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          title="No delays"
          description="Every booking in a service with a configured SLA is within its deadline."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total delays" value={String(data.totals.total)} />
            <Stat label="Open delays" value={String(data.totals.open)} hint={`${data.totals.openBookings} booking${data.totals.openBookings === 1 ? "" : "s"}`} />
            <Stat label="Resolved delays" value={String(data.totals.resolved)} hint="Completed after the deadline" />
            <Stat label="Average delay" value={formatDuration(data.totals.averageDelayHours)} hint="Time past the deadline" />
            <Stat label="Longest open" value={formatDuration(data.totals.longestOpenHours)} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <BreakdownCard title="By service" rows={data.byService} />
            <BreakdownCard title="By reason" rows={data.byReason} />
            <BreakdownCard title="By category" rows={data.byCategory} />
            <BreakdownCard title="By staff" rows={data.byStaff} />
            <BreakdownCard title="By vendor" rows={data.byVendor} />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={selectClass}>
                <option value="OPEN">Open</option>
                <option value="RESOLVED">Resolved</option>
                <option value="ALL">All</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
              Service
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className={selectClass}>
                <option value="">All services</option>
                {data.configuredServices.map((service) => (
                  <option key={service.serviceType} value={service.serviceType}>
                    {service.serviceLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
              Reason
              <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value as DelayType | "")} className={selectClass}>
                <option value="">All reasons</option>
                {data.byReason.map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {visibleRecords.length === 0 ? (
            <EmptyState title="No delays match these filters" description="Try a different status, service or reason." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                    <th className="px-4 py-3">Booking</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Service date</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Delay</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.key} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/crm/bookings/${record.bookingId}`} className="text-ink-accent hover:underline">
                          {record.bookingReference}
                        </Link>
                        <div className="text-xs text-ink-tertiary">{record.serviceLabel}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-primary">{record.customerName}</td>
                      <td className="px-4 py-3 text-ink-secondary">{record.serviceDate ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-tertiary">{formatDateTime(record.startedAt)}</td>
                      <td className="px-4 py-3 font-medium text-ink-primary">
                        {formatDuration(record.delayHours)}
                        <div className="text-xs font-normal text-ink-tertiary">due {formatDateTime(record.dueAt)}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">
                        {record.reason}
                        {record.documentType ? <div className="text-xs text-ink-tertiary">{record.documentType}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{record.category}</td>
                      <td className="px-4 py-3 text-ink-secondary">{record.staffName ?? "Unassigned"}</td>
                      <td className="px-4 py-3 text-ink-secondary">{record.vendorName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            record.status === "OPEN" ? "bg-error/10 text-error" : "bg-success/10 text-success"
                          )}
                        >
                          {record.status === "OPEN" ? "Open" : "Resolved"}
                        </span>
                        <div className="mt-1 text-xs text-ink-tertiary">{record.bookingStatusLabel}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-ink-tertiary">
            Showing {visibleRecords.length} of {data.records.length} delay{data.records.length === 1 ? "" : "s"}.
          </p>
        </>
      )}
    </div>
  );
}
