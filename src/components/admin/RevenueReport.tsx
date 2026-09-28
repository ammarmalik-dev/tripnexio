"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface ServiceRevenue {
  serviceType: string;
  label: string;
  revenue: string;
  count: number;
}

interface RevenueReportData {
  from: string;
  to: string;
  paymentCount: number;
  grossRevenue: string;
  couponDiscount: string;
  gatewayCharges: string;
  gstCollected: string;
  refunds: string;
  netRevenue: string;
  byService: ServiceRevenue[];
  assumptions: string[];
}

type FetchState = "loading" | "success" | "error";

function money(value: string): string {
  const number = Number(value);
  return `${number < 0 ? "-" : ""}₹${Math.abs(number).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firstOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function LineItem({ label, value, muted, emphasis }: { label: string; value: string; muted?: boolean; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={cn("text-sm", muted ? "text-ink-tertiary" : "text-ink-secondary")}>{label}</span>
      <span className={cn("text-sm font-medium", emphasis ? "text-lg font-semibold text-ink-heading" : "text-ink-primary")}>{money(value)}</span>
    </div>
  );
}

/** Business Rules §15 "Finance Reports + MIS" — item 1 Revenue Report, folding in item 13 Service-wise Revenue Report as one section. Reporting-only. */
export function RevenueReport() {
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [state, setState] = useState<FetchState>("loading");
  const [report, setReport] = useState<RevenueReportData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<RevenueReportData>(`/api/admin/revenue-report?from=${from}&to=${to}`);
        if (cancelled) return;
        setReport(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the revenue report. Please try again.");
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
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load the revenue report"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : report ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-2 text-sm font-semibold text-ink-heading">Revenue</h2>
            <LineItem label="Gross Revenue" value={report.grossRevenue} />
            <LineItem label="Coupon Discount" value={`-${report.couponDiscount}`} muted />
            <LineItem label="Refunds" value={`-${report.refunds}`} muted />
            <div className="border-t border-hairline pt-1.5">
              <LineItem label="Net Revenue" value={report.netRevenue} emphasis />
            </div>
            <p className="mt-2 text-xs text-ink-tertiary">{report.paymentCount} successful payment(s) in this range.</p>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-2 text-sm font-semibold text-ink-heading">Other Figures (informational)</h2>
            <LineItem label="Gateway Charges" value={report.gatewayCharges} muted />
            <LineItem label="GST Collected" value={report.gstCollected} muted />
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-5 lg:col-span-2">
            <h2 className="mb-2 text-sm font-semibold text-ink-heading">Revenue by Service</h2>
            {report.byService.length === 0 ? (
              <p className="text-sm text-ink-tertiary">No revenue recorded in this range.</p>
            ) : (
              report.byService.map((entry) => (
                <div key={entry.serviceType} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-ink-secondary">
                    {entry.label} <span className="text-xs text-ink-tertiary">({entry.count})</span>
                  </span>
                  <span className="text-sm font-medium text-ink-primary">{money(entry.revenue)}</span>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-5 lg:col-span-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink-heading">Assumptions</h2>
            </div>
            <ul className="list-disc pl-5 text-xs text-ink-tertiary">
              {report.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
