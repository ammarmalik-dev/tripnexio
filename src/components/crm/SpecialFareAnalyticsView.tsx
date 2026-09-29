"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { getJson, ApiError } from "@/lib/api/client";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { cn } from "@/lib/cn";
import type { SpecialFareAnalytics } from "@/lib/special-fare/analytics";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const money = (value: number | null) => (value === null ? "—" : `₹${value.toLocaleString("en-IN")}`);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-4">
      <span className="text-xs text-ink-tertiary">{label}</span>
      <span className="text-xl font-semibold text-ink-heading">{value}</span>
      {hint ? <span className="text-xs text-ink-tertiary">{hint}</span> : null}
    </div>
  );
}

function ListCard({ title, rows, empty }: { title: string; rows: { label: string; value: string }[]; empty: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
      <h2 className="text-sm font-semibold text-ink-heading">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-tertiary">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-secondary">{row.label}</span>
              <span className="font-medium text-ink-primary">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** P16 — Flight_Special_Fare.md §25 Phase 1 analytics. */
export function SpecialFareAnalyticsView() {
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [data, setData] = useState<SpecialFareAnalytics | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<SpecialFareAnalytics>(`/api/crm/analytics/special-fare?from=${from}&to=${to}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the analytics.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to, reloadNonce]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
          From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm")} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
          To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm")} />
        </label>
      </div>

      {state === "loading" ? (
        <Skeleton className="h-96 w-full" />
      ) : state === "error" || !data ? (
        <ErrorState
          title="Couldn't load the analytics"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : data.enquiries === 0 ? (
        <EmptyState title="No Special Fare enquiries in this period" description="Pick a wider date range." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Enquiries" value={String(data.enquiries)} />
            <Stat label="Quotes created / sent" value={`${data.quotesCreated} / ${data.quotesSent}`} />
            <Stat label="Quotes expired" value={String(data.quotesExpired)} />
            <Stat label="New quote requests" value={String(data.newQuoteRequests)} />
            <Stat label="Bookings (paid)" value={`${data.bookings} (${data.paidBookings})`} />
            <Stat label="Conversion" value={data.conversionPercent === null ? "—" : `${data.conversionPercent}%`} hint="Paid bookings ÷ enquiries" />
            <Stat
              label="Average response time"
              value={data.averageResponseMinutes === null ? "—" : data.averageResponseMinutes < 120 ? `${data.averageResponseMinutes} min` : `${Math.round(data.averageResponseMinutes / 6) / 10} h`}
              hint="Enquiry → first quote"
            />
            <Stat label="Average selling price" value={money(data.averageSellingPrice)} />
            {data.averageMargin !== null ? <Stat label="Average margin (admin)" value={money(data.averageMargin)} /> : null}
            <Stat
              label="7-day conversion"
              value={data.sevenDayConversion.percent === null ? "—" : `${data.sevenDayConversion.percent}%`}
              hint={`${data.sevenDayConversion.converted} paid within 7 days`}
            />
            <Stat label="Refunds" value={`${data.refunds.count} · ${money(data.refunds.amount)}`} hint={`${data.refunds.cancelledBookings} cancelled/refunded bookings`} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ListCard title="Most requested routes" rows={data.topRoutes.map((r) => ({ label: r.label, value: String(r.count) }))} empty="No routes yet." />
            <ListCard title="Top departure airports" rows={data.topDepartureAirports.map((r) => ({ label: r.label, value: String(r.count) }))} empty="No data yet." />
            <ListCard
              title="Best vendors"
              rows={data.bestVendors.map((v) => ({ label: v.vendor, value: `${v.paidBookings} paid · ${money(v.revenue)}` }))}
              empty="No paid bookings yet."
            />
            <ListCard
              title="Staff conversion"
              rows={data.staffConversion.map((s) => ({ label: s.staff, value: `${s.converted}/${s.enquiries} (${s.conversionPercent}%)` }))}
              empty="No enquiries yet."
            />
          </div>
        </>
      )}
    </div>
  );
}
