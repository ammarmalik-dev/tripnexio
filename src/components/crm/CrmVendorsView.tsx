"use client";

import { useEffect, useState } from "react";
import { GitCompare, X } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, ApiError } from "@/lib/api/client";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import type { StaffVendorCost, StaffVendorRow, StaffVendorsView } from "@/lib/vendors/staff-view";

const MIN_COMPARE = 2;
const MAX_COMPARE = 4;

const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function costText(cost: StaffVendorCost): string {
  return cost.average === null ? `${cost.label}: no quotes` : `${cost.label}: ${money(cost.average)} (${cost.quotations})`;
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-heading" title="Recommendation score (1-5, admin-configured weights)">
      {score.toFixed(1)} / 5
    </span>
  );
}

function VendorCard({
  vendor,
  compareMode,
  selected,
  selectionFull,
  onToggle,
  costWindowDays,
}: {
  vendor: StaffVendorRow;
  compareMode: boolean;
  selected: boolean;
  selectionFull: boolean;
  onToggle: (id: string) => void;
  costWindowDays: number;
}) {
  const checkboxId = `vendor-compare-${vendor.id}`;
  return (
    <li className={cn("flex flex-col gap-3 rounded-xl border bg-surface-1 p-4", selected ? "border-accent" : "border-hairline")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {compareMode ? (
            <input
              id={checkboxId}
              type="checkbox"
              checked={selected}
              disabled={!selected && selectionFull}
              onChange={() => onToggle(vendor.id)}
              className="mt-1 h-4 w-4 accent-accent"
              aria-label={`Select ${vendor.name} to compare`}
            />
          ) : null}
          <h2 className="text-sm font-semibold text-ink-heading">
            {compareMode ? <label htmlFor={checkboxId}>{vendor.name}</label> : vendor.name}
          </h2>
        </div>
        <ScoreBadge score={vendor.score} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {vendor.services.length === 0 ? (
          <span className="text-xs text-ink-tertiary">No services configured</span>
        ) : (
          vendor.services.map((s) => (
            <span key={s.serviceType} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
              {s.label}
            </span>
          ))
        )}
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-tertiary">Processing</dt>
          <dd className="text-ink-primary">{vendor.processingDetails || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Availability</dt>
          <dd className="text-ink-primary">{vendor.availability || "—"}</dd>
        </div>
        {vendor.averageCost ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-tertiary">Avg. vendor cost, last {costWindowDays} days (internal)</dt>
            <dd className="flex flex-col text-ink-primary">
              {vendor.averageCost.length === 0 ? "—" : vendor.averageCost.map((cost) => <span key={cost.serviceType}>{costText(cost)}</span>)}
            </dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

function CompareTable({ vendors, canViewCost, costWindowDays }: { vendors: StaffVendorRow[]; canViewCost: boolean; costWindowDays: number }) {
  const rows: { label: string; render: (v: StaffVendorRow) => string }[] = [
    { label: "Recommendation score", render: (v) => `${v.score.toFixed(1)} / 5` },
    { label: "Services", render: (v) => v.services.map((s) => s.label).join(", ") || "—" },
    { label: "Processing", render: (v) => v.processingDetails || "—" },
    { label: "Availability", render: (v) => v.availability || "—" },
    { label: "Service suitability", render: (v) => `${v.factorScores.serviceSuitability} / 5` },
    { label: "Processing time", render: (v) => `${v.factorScores.processingTime} / 5` },
    { label: "Performance", render: (v) => `${v.factorScores.performance} / 5` },
    { label: "Reliability", render: (v) => `${v.factorScores.reliability} / 5` },
  ];
  if (canViewCost) {
    rows.push({
      label: `Avg. vendor cost (${costWindowDays}d, internal)`,
      render: (v) => (v.averageCost && v.averageCost.length > 0 ? v.averageCost.map(costText).join("; ") : "—"),
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4" aria-label="Vendor comparison">
      <h2 className="text-sm font-semibold text-ink-heading">Side-by-side comparison</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className="py-2 pr-3 text-xs font-medium text-ink-tertiary">
                Attribute
              </th>
              {vendors.map((v) => (
                <th key={v.id} scope="col" className="py-2 px-3 font-semibold text-ink-heading">
                  {v.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-hairline align-top last:border-0">
                <th scope="row" className="py-2 pr-3 text-xs font-medium text-ink-tertiary">
                  {row.label}
                </th>
                {vendors.map((v) => (
                  <td key={v.id} className="py-2 px-3 text-ink-primary">
                    {row.render(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** P22 item 6 — CRM.md §24 staff Vendors view (read-only; Admin manages vendors). */
export function CrmVendorsView() {
  const [service, setService] = useState("");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [data, setData] = useState<StaffVendorsView | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<StaffVendorsView>(`/api/crm/vendors${service ? `?service=${encodeURIComponent(service)}` : ""}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load vendors.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [service, reloadNonce]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX_COMPARE ? current : [...current, id]));
  }

  function exitCompare() {
    setCompareMode(false);
    setSelectedIds([]);
  }

  // Only compare vendors still present in the current (filtered) list.
  const selectedVendors = data ? data.vendors.filter((v) => selectedIds.includes(v.id)) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
          Service
          <select value={service} onChange={(e) => setService(e.target.value)} className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto text-sm")}>
            <option value="">All services</option>
            {SERVICE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {compareMode ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-tertiary" aria-live="polite">
              {selectedVendors.length} of {MAX_COMPARE} selected
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={exitCompare}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Exit compare
            </Button>
          </div>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setCompareMode(true)} disabled={!data || data.vendors.length < MIN_COMPARE}>
            <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
            Compare
          </Button>
        )}
      </div>

      {compareMode ? (
        selectedVendors.length >= MIN_COMPARE && data ? (
          <CompareTable vendors={selectedVendors} canViewCost={data.canViewCost} costWindowDays={data.costWindowDays} />
        ) : (
          <p className="rounded-xl border border-dashed border-hairline p-4 text-sm text-ink-tertiary">
            Select {MIN_COMPARE}–{MAX_COMPARE} vendors below to compare them side by side.
          </p>
        )
      ) : null}

      {state === "loading" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-busy="true" aria-label="Loading vendors">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state === "error" || !data ? (
        <ErrorState
          title="Couldn't load vendors"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : data.vendors.length === 0 ? (
        <EmptyState title="No active vendors" description={service ? "No active vendor offers this service. Try another service." : "No active vendors are configured yet — Admin manages vendors."} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              compareMode={compareMode}
              selected={selectedIds.includes(vendor.id)}
              selectionFull={selectedIds.length >= MAX_COMPARE}
              onToggle={toggleSelected}
              costWindowDays={data.costWindowDays}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
