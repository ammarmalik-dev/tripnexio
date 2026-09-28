"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, ApiError } from "@/lib/api/client";

interface RefundStatusBreakdown {
  status: string;
  label: string;
  count: number;
  amount: string;
}

interface RefundServiceBreakdown {
  serviceType: string;
  label: string;
  count: number;
  amount: string;
}

interface RefundRow {
  id: string;
  bookingId: string;
  leadReference: string;
  customerName: string;
  serviceType: string;
  status: string;
  refundAmount: string;
  reason: string;
  createdAt: string;
}

interface RefundReportData {
  from: string;
  to: string;
  refundCount: number;
  totalRefundAmount: string;
  completedAmount: string;
  byStatus: RefundStatusBreakdown[];
  byService: RefundServiceBreakdown[];
  rows: RefundRow[];
}

type FetchState = "loading" | "success" | "error";

function money(value: string): string {
  return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firstOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Business Rules §15 "Finance Reports + MIS" — item 8 Refund Report. Reporting-only; refund status itself is still changed only from the Refunds screen. */
export function RefundReport() {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [state, setState] = useState<FetchState>("loading");
  const [report, setReport] = useState<RefundReportData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<RefundReportData>(`/api/admin/refund-report?from=${from}&to=${to}`);
        if (cancelled) return;
        setReport(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the refund report. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to, reloadNonce]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
        <TextField label="From" name="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <TextField label="To" name="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Button type="button" size="sm" variant="ghost" onClick={() => setReloadNonce((current) => current + 1)}>
          Refresh
        </Button>
        <a
          href={`/api/admin/refund-report/export?from=${from}&to=${to}`}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border hover:bg-white/[0.03]"
        >
          Export CSV
        </a>
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load the refund report"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : report ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-hairline bg-surface-1 p-5">
              <p className="text-xs text-ink-tertiary">Total Refunds</p>
              <p className="mt-1 text-lg font-semibold text-ink-heading">{report.refundCount}</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-1 p-5">
              <p className="text-xs text-ink-tertiary">Total Refund Amount</p>
              <p className="mt-1 text-lg font-semibold text-ink-heading">{money(report.totalRefundAmount)}</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-1 p-5">
              <p className="text-xs text-ink-tertiary">Completed Amount</p>
              <p className="mt-1 text-lg font-semibold text-ink-heading">{money(report.completedAmount)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-5">
              <h2 className="mb-2 text-sm font-semibold text-ink-heading">By Status</h2>
              {report.byStatus.length === 0 ? (
                <p className="text-sm text-ink-tertiary">No refunds in this range.</p>
              ) : (
                report.byStatus.map((entry) => (
                  <div key={entry.status} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-ink-secondary">
                      {entry.label} <span className="text-xs text-ink-tertiary">({entry.count})</span>
                    </span>
                    <span className="text-sm font-medium text-ink-primary">{money(entry.amount)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-5">
              <h2 className="mb-2 text-sm font-semibold text-ink-heading">By Service</h2>
              {report.byService.length === 0 ? (
                <p className="text-sm text-ink-tertiary">No refunds in this range.</p>
              ) : (
                report.byService.map((entry) => (
                  <div key={entry.serviceType} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-ink-secondary">
                      {entry.label} <span className="text-xs text-ink-tertiary">({entry.count})</span>
                    </span>
                    <span className="text-sm font-medium text-ink-primary">{money(entry.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Refunds</h2>
            {report.rows.length === 0 ? (
              <EmptyState title="No refunds in this range" description="Try a different date range." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-xs text-ink-tertiary">
                      <th className="py-2 pr-4 font-medium">Booking</th>
                      <th className="py-2 pr-4 font-medium">Customer</th>
                      <th className="py-2 pr-4 font-medium">Service</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Reason</th>
                      <th className="py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.id} className="border-b border-hairline/60 last:border-0">
                        <td className="py-2 pr-4 text-ink-primary">{row.bookingId}</td>
                        <td className="py-2 pr-4 text-ink-secondary">{row.customerName}</td>
                        <td className="py-2 pr-4 text-ink-secondary">{row.serviceType}</td>
                        <td className="py-2 pr-4 text-ink-secondary">{row.status}</td>
                        <td className="py-2 pr-4 font-medium text-ink-primary">{money(row.refundAmount)}</td>
                        <td className="py-2 pr-4 text-ink-tertiary">{row.reason || "—"}</td>
                        <td className="py-2 text-ink-tertiary">{new Date(row.createdAt).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
