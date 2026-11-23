"use client";

import { useEffect, useState } from "react";
import { getJson, putJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import type { SalesTrackerRow } from "@/lib/reports/sales-tracker";

interface TrackerData {
  rows: SalesTrackerRow[];
  team: SalesTrackerRow;
  months: string[];
  targets: { userId: string; month: string; targetConverted: number; targetRevenue: number }[];
}
interface StaffOption {
  id: string;
  name: string;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const achievement = (value: number | null) => (value === null ? "—" : `${value}%`);

/** One POC's target for a month (converted leads + revenue). */
function TargetEditor({ staff, month, existing, onSaved }: { staff: StaffOption[]; month: string; existing: TrackerData["targets"]; onSaved: () => void }) {
  const [userId, setUserId] = useState("");
  const [targetMonth, setTargetMonth] = useState(month);
  const current = existing.find((row) => row.userId === userId && row.month === targetMonth);
  const [converted, setConverted] = useState("");
  const [revenue, setRevenue] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await putJson("/api/admin/sales-tracker", { userId, month: targetMonth, targetConverted: Number(converted || current?.targetConverted || 0), targetRevenue: Number(revenue || current?.targetRevenue || 0) });
      toast.success("Target saved.");
      setConverted("");
      setRevenue("");
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the target.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4">
      <label className="flex flex-col gap-1 text-xs text-ink-secondary">
        POC
        <select value={userId} onChange={(event) => setUserId(event.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9 min-w-[180px]")}>
          <option value="">Select a POC</option>
          {staff.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-secondary">
        Month
        <input type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9")} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-secondary">
        Converted leads target
        <input inputMode="numeric" value={converted} placeholder={current ? String(current.targetConverted) : "e.g. 40"} onChange={(event) => setConverted(event.target.value.replace(/\D/g, ""))} className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-36")} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-secondary">
        Revenue target (₹)
        <input inputMode="decimal" value={revenue} placeholder={current ? String(current.targetRevenue) : "e.g. 500000"} onChange={(event) => setRevenue(event.target.value.replace(/[^\d.]/g, ""))} className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-40")} />
      </label>
      <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={!userId || !targetMonth || (!converted && !revenue)}>
        Save Target
      </Button>
    </div>
  );
}

/**
 * Client doc 16 Nov (J9) — Admin Sales Tracker: monthly targets per POC, and POC-wise + team performance (assigned
 * leads, leads received, converted leads, successful payments, revenue, conversion rate, target vs. achievement),
 * filtered by POC, date range and service.
 */
export function SalesTracker() {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))));
  const [to, setTo] = useState(iso(today));
  const [serviceType, setServiceType] = useState("");
  const [staffId, setStaffId] = useState("");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [data, setData] = useState<TrackerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({ from, to, ...(serviceType ? { serviceType } : {}), ...(staffId ? { staffId } : {}) });
        const [result, people] = [await getJson<TrackerData>(`/api/admin/sales-tracker?${params}`), await getJson<StaffOption[]>("/api/staff").catch(() => [] as StaffOption[])];
        if (cancelled) return;
        setData(result);
        setStaff(people);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the sales tracker.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to, serviceType, staffId, nonce]);

  const row = (item: SalesTrackerRow, team = false) => (
    <tr key={item.userId ?? "team"} className={cn("border-t border-hairline", team && "bg-surface-2 font-semibold")}>
      <td className="px-3 py-2 text-ink-primary">{item.name}</td>
      <td className="px-3 py-2 text-right">{item.assignedLeads}</td>
      <td className="px-3 py-2 text-right">{item.totalLeads}</td>
      <td className="px-3 py-2 text-right">{item.convertedLeads}</td>
      <td className="px-3 py-2 text-right">{item.successfulPayments}</td>
      <td className="px-3 py-2 text-right">{money(item.revenue)}</td>
      <td className="px-3 py-2 text-right">{item.conversionRate}%</td>
      <td className="px-3 py-2 text-right">
        {item.targetConverted ? `${item.convertedLeads} / ${item.targetConverted} (${achievement(item.convertedAchievement)})` : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        {item.targetRevenue ? `${money(item.revenue)} / ${money(item.targetRevenue)} (${achievement(item.revenueAchievement)})` : "—"}
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3">
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9")} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9")} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          Service
          <select value={serviceType} onChange={(event) => setServiceType(event.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9 min-w-[170px]")}>
            <option value="">All services</option>
            {Object.entries(SERVICE_TYPE_LABELS)
              .filter(([value]) => value !== "OTHER")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          POC
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9 min-w-[170px]")}>
            <option value="">Every POC</option>
            {staff.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <ErrorState
          title="Couldn't load the sales tracker"
          description={error}
          action={
            <Button type="button" size="sm" onClick={() => setNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.rows.length === 0 ? (
        <EmptyState title="No sales activity in this period" description="Pick another date range, service or POC — or set targets below." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-right text-xs text-ink-secondary">
                <th className="px-3 py-2 text-left font-medium">POC</th>
                <th className="px-3 py-2 font-medium">Assigned (open)</th>
                <th className="px-3 py-2 font-medium">Total leads</th>
                <th className="px-3 py-2 font-medium">Converted</th>
                <th className="px-3 py-2 font-medium">Successful payments</th>
                <th className="px-3 py-2 font-medium">Revenue</th>
                <th className="px-3 py-2 font-medium">Conversion</th>
                <th className="px-3 py-2 font-medium">Converted vs target</th>
                <th className="px-3 py-2 font-medium">Revenue vs target</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((item) => row(item))}
              {data.rows.length > 1 ? row(data.team, true) : null}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-tertiary">
        Total leads, converted leads and conversion count leads received in the period; payments and revenue (excluding GST and gateway fees, after
        coupons) count successful payments in the period. Targets add up the monthly targets of the months in the period.
      </p>
      <h2 className="text-sm font-semibold text-ink-heading">Monthly targets</h2>
      <TargetEditor staff={staff} month={to.slice(0, 7)} existing={data?.targets ?? []} onSaved={() => setNonce((n) => n + 1)} />
    </div>
  );
}
