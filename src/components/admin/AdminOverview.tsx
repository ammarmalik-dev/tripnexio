"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, CreditCard, ListChecks, Radio, ScanText, ShieldAlert, Workflow } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { getJson, ApiError } from "@/lib/api/client";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { AdminOverview as AdminOverviewData } from "@/lib/admin/overview";
import { cn } from "@/lib/cn";

const PRESETS = [7, 30, 90] as const;
const RUPEES = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

type FetchState = "loading" | "success" | "error";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 px-4 py-3">
      <span className="text-xs leading-snug font-medium text-ink-tertiary">{label}</span>
      <span className="text-2xl font-bold tracking-tight text-ink-heading tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-ink-tertiary">{hint}</span> : null}
    </div>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-tertiary">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-secondary">{row.label}</span>
                <span className="font-semibold text-ink-heading tabular-nums">{row.count}</span>
              </span>
              <span className="h-1.5 rounded-full bg-ink-primary/[0.06]">
                <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertRow({ icon: Icon, label, count, href }: { icon: typeof AlertTriangle; label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-ink-primary/[0.03]"
    >
      <span className="flex items-center gap-2.5 text-sm text-ink-primary">
        <Icon className={cn("h-4 w-4", count > 0 ? "text-error" : "text-ink-tertiary")} aria-hidden="true" />
        {label}
      </span>
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", count > 0 ? "bg-error/10 text-error" : "bg-success/10 text-success")}>
        {count}
      </span>
    </Link>
  );
}

/** Client corrections 2026-10-05 — the Admin home: business overview with source breakdowns, finance, workload and alerts. */
export function AdminOverview({ staffName }: { staffName: string }) {
  const [days, setDays] = useState<(typeof PRESETS)[number]>(30);
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [state, setState] = useState<FetchState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<AdminOverviewData>(`/api/admin/overview?days=${days}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the overview. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [days, reloadNonce]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-heading">Overview</h1>
          <p className="text-sm text-ink-tertiary">Welcome back, {staffName}. Business and platform at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Period">
          {PRESETS.map((preset) => (
            <Button key={preset} type="button" size="sm" variant={days === preset ? "primary" : "ghost"} aria-pressed={days === preset} onClick={() => setDays(preset)}>
              Last {preset} Days
            </Button>
          ))}
          <Link href="/admin/live-activity" className="ml-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-accent hover:underline">
            <Radio className="h-4 w-4" aria-hidden="true" />
            Live Activity
          </Link>
        </div>
      </div>

      {state === "loading" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state === "success" && data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Leads" value={String(data.leads.total)} />
            <StatCard label="Paid Bookings" value={String(data.bookings.total)} />
            {data.finance ? (
              <>
                <StatCard label="Revenue" value={RUPEES.format(data.finance.revenue)} hint="Excl. GST & gateway fee" />
                <StatCard
                  label="Gross Profit"
                  value={RUPEES.format(data.finance.grossProfit)}
                  hint={data.finance.marginPercent === null ? "Margin —" : `Margin ${data.finance.marginPercent}%`}
                />
                <StatCard label="Refunds" value={RUPEES.format(data.finance.refunds)} />
                <StatCard label="Net Profit" value={RUPEES.format(data.finance.netProfit)} hint={`Expenses ${RUPEES.format(data.finance.expenses)}`} />
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Breakdown
              title="Leads by Source"
              rows={data.leads.bySource.map((row) => ({ label: row.source, count: row.count }))}
              empty="No leads in this period."
            />
            <Breakdown
              title="Paid Bookings by Source"
              rows={data.bookings.bySource.map((row) => ({ label: row.source, count: row.count }))}
              empty="No paid bookings in this period."
            />
            <Breakdown
              title="Leads by Service"
              rows={data.leads.byService.map((row) => ({ label: SERVICE_TYPE_LABELS[row.serviceType], count: row.count }))}
              empty="No leads in this period."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-3">
              <h2 className="px-2 pt-2 pb-1 text-sm font-semibold text-ink-heading">Alerts &amp; Exceptions</h2>
              <AlertRow icon={ShieldAlert} label="Go-live checks failing" count={data.alerts.goLiveRedChecks} href="/admin/automation" />
              <AlertRow icon={CreditCard} label="Failed or expired payments" count={data.alerts.failedPayments} href="/crm/payments?status=FAILED" />
              <AlertRow icon={ScanText} label="OCR failures" count={data.alerts.ocrFailures} href="/admin/ocr-monitor" />
              <AlertRow icon={Workflow} label="Failed automation runs" count={data.alerts.failedAutomationRuns} href="/admin/automation" />
              <AlertRow icon={AlertTriangle} label="Open complaints" count={data.alerts.openComplaints} href="/admin/enquiries" />
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink-heading">Staff Workload</h2>
                <span className="text-xs text-ink-tertiary">Open leads now</span>
              </div>
              {data.workload.length === 0 ? (
                <p className="text-sm text-ink-tertiary">No open leads.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-hairline">
                  {data.workload.map((row) => (
                    <li key={row.staffId ?? "unassigned"} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className={cn(row.staffId ? "text-ink-primary" : "text-warning")}>{row.name}</span>
                      <span className="font-semibold text-ink-heading tabular-nums">{row.openLeads}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 font-medium text-ink-accent hover:underline">
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              All bookings
            </Link>
            <Link href="/crm/leads" className="inline-flex items-center gap-1.5 font-medium text-ink-accent hover:underline">
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Leads in the Internal Dashboard
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
