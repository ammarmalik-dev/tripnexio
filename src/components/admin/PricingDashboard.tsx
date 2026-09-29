"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { ListPagination } from "@/components/crm/ListPagination";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceType, PaxType } from "../../generated/prisma/enums";

type RuleStatus = "active" | "expired" | "upcoming" | "inactive";

interface DashboardRow {
  id: string;
  serviceType: ServiceType;
  country: { id: string; name: string } | null;
  subService: { id: string; name: string } | null;
  visaType: { id: string; name: string } | null;
  processingType: string | null;
  processingLabel: string | null;
  paxType: PaxType;
  nationality: string | null;
  sellingPrice: number;
  additionalCharges: number;
  totalPrice: number;
  vendorCost: number;
  margin: number;
  validityFrom: string | null;
  validityUntil: string | null;
  active: boolean;
  status: RuleStatus;
}

interface DashboardSummary {
  total: number;
  active: number;
  expiringSoon: number;
  expiringSoonDays: number;
  expired: number;
  upcoming: number;
}

interface DashboardOptions {
  countries: { id: string; name: string; active: boolean }[];
  subServices: { id: string; serviceType: ServiceType; name: string; active: boolean }[];
  visaTypes: { id: string; name: string; countryId: string | null; active: boolean }[];
  processingTypes: { serviceType: ServiceType; code: string; label: string }[];
}

interface DashboardResponse {
  items: DashboardRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: DashboardSummary;
  options: DashboardOptions | null;
}

interface Filters {
  countryId: string;
  serviceType: ServiceType | "";
  subServiceId: string;
  visaTypeId: string;
  processingType: string;
  active: "" | "true" | "false";
  status: RuleStatus | "";
  effectiveDate: string;
  expiringWithinDays: string;
}

const EMPTY_FILTERS: Filters = {
  countryId: "",
  serviceType: "",
  subServiceId: "",
  visaTypeId: "",
  processingType: "",
  active: "",
  status: "",
  effectiveDate: "",
  expiringWithinDays: "",
};

const PAGE_SIZE = 25;
const EXPIRY_WINDOWS = [7, 15, 30, 60, 90];

const STATUS_LABELS: Record<RuleStatus, string> = {
  active: "Active",
  expired: "Expired",
  upcoming: "Upcoming",
  inactive: "Disabled",
};

const STATUS_CLASSES: Record<RuleStatus, string> = {
  active: "bg-success/10 text-success",
  expired: "bg-error/10 text-error",
  upcoming: "bg-info/10 text-info",
  inactive: "bg-surface-2 text-ink-tertiary",
};

function money(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return "Open";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function buildQuery(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  params.set("page", String(page));
  params.set("pageSize", String(PAGE_SIZE));
  return params.toString();
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  options,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <FormField label={label} htmlFor={id}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false))}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function SummaryTile({ label, value, hint, active, onClick }: { label: string; value: number; hint: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border bg-surface-1 p-4 text-left transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        active ? "border-accent" : "border-hairline hover:border-accent/50"
      )}
    >
      <span className="text-xs font-medium text-ink-tertiary">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-ink-heading">{value}</span>
      <span className="text-xs text-ink-tertiary">{hint}</span>
    </button>
  );
}

/**
 * P23 — Admin Pricing ("Quotation") Dashboard: every PricingRule with
 * scope/validity filters, a computed status, summary tiles and server-side
 * pagination. Shows internal vendor cost and margin (Admin, masters.manage).
 */
export function PricingDashboard() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [options, setOptions] = useState<DashboardOptions | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  /** The filter dropdown sources are requested with the first successful load only. */
  const optionsLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const needsOptions = !optionsLoadedRef.current;
        const result = await getJson<DashboardResponse>(`/api/admin/pricing-dashboard?${buildQuery(filters, page)}${needsOptions ? "&includeOptions=1" : ""}`);
        if (cancelled) return;
        setData(result);
        if (result.options) {
          optionsLoadedRef.current = true;
          setOptions(result.options);
        }
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the pricing dashboard. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadNonce]);

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const subServiceOptions = (options?.subServices ?? [])
    .filter((entry) => !filters.serviceType || entry.serviceType === filters.serviceType)
    .map((entry) => ({ value: entry.id, label: `${entry.name}${filters.serviceType ? "" : ` (${SERVICE_TYPE_LABELS[entry.serviceType]})`}${entry.active ? "" : " — inactive"}` }));
  const visaTypeOptions = (options?.visaTypes ?? [])
    .filter((entry) => !filters.countryId || !entry.countryId || entry.countryId === filters.countryId)
    .map((entry) => ({ value: entry.id, label: `${entry.name}${entry.active ? "" : " — inactive"}` }));
  const processingOptions = [
    ...new Map(
      (options?.processingTypes ?? [])
        .filter((entry) => !filters.serviceType || entry.serviceType === filters.serviceType)
        .map((entry) => [entry.code, { value: entry.code, label: entry.label }] as const)
    ).values(),
  ];

  const summary = data?.summary;
  const filtersApplied = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Pricing summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary ? (
          <>
            <SummaryTile
              label="Active"
              value={summary.active}
              hint="In effect today"
              active={filters.status === "active" && !filters.expiringWithinDays}
              onClick={() => updateFilters({ status: "active", expiringWithinDays: "" })}
            />
            <SummaryTile
              label={`Expiring in ${summary.expiringSoonDays} days`}
              value={summary.expiringSoon}
              hint="Active, validity ending soon"
              active={filters.expiringWithinDays === String(summary.expiringSoonDays)}
              onClick={() => updateFilters({ status: "", active: "true", expiringWithinDays: String(summary.expiringSoonDays) })}
            />
            <SummaryTile
              label="Expired"
              value={summary.expired}
              hint="Validity already ended"
              active={filters.status === "expired"}
              onClick={() => updateFilters({ status: "expired", expiringWithinDays: "" })}
            />
            <SummaryTile
              label="Upcoming"
              value={summary.upcoming}
              hint="Starts on a future date"
              active={filters.status === "upcoming"}
              onClick={() => updateFilters({ status: "upcoming", expiringWithinDays: "" })}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
        )}
      </section>

      <section aria-label="Filters" className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect
            id="pd-serviceType"
            label="Service"
            value={filters.serviceType}
            allLabel="All services"
            options={SERVICE_TYPE_OPTIONS}
            onChange={(value) => updateFilters({ serviceType: value as ServiceType | "", subServiceId: "", processingType: "" })}
          />
          <FilterSelect
            id="pd-subServiceId"
            label="Sub-service"
            value={filters.subServiceId}
            allLabel="All sub-services"
            options={subServiceOptions}
            disabled={subServiceOptions.length === 0}
            onChange={(value) => updateFilters({ subServiceId: value })}
          />
          <FilterSelect
            id="pd-countryId"
            label="Country"
            value={filters.countryId}
            allLabel="All countries"
            options={(options?.countries ?? []).map((entry) => ({ value: entry.id, label: `${entry.name}${entry.active ? "" : " — inactive"}` }))}
            onChange={(value) => updateFilters({ countryId: value, visaTypeId: "" })}
          />
          <FilterSelect
            id="pd-visaTypeId"
            label="Visa type"
            value={filters.visaTypeId}
            allLabel="All visa types"
            options={visaTypeOptions}
            disabled={visaTypeOptions.length === 0}
            onChange={(value) => updateFilters({ visaTypeId: value })}
          />
          <FilterSelect
            id="pd-processingType"
            label="Processing type"
            value={filters.processingType}
            allLabel="All processing types"
            options={processingOptions}
            disabled={processingOptions.length === 0}
            onChange={(value) => updateFilters({ processingType: value })}
          />
          <FilterSelect
            id="pd-active"
            label="Enabled"
            value={filters.active}
            allLabel="Enabled and disabled"
            options={[
              { value: "true", label: "Enabled only" },
              { value: "false", label: "Disabled only" },
            ]}
            onChange={(value) => updateFilters({ active: value as Filters["active"] })}
          />
          <FilterSelect
            id="pd-status"
            label="Status"
            value={filters.status}
            allLabel="Any status"
            options={(Object.keys(STATUS_LABELS) as RuleStatus[]).map((value) => ({ value, label: STATUS_LABELS[value] }))}
            onChange={(value) => updateFilters({ status: value as RuleStatus | "" })}
          />
          <FormField label="In effect on" htmlFor="pd-effectiveDate" hint="Validity from ≤ date ≤ validity until (blank bounds are open).">
            <input
              id="pd-effectiveDate"
              type="date"
              value={filters.effectiveDate}
              onChange={(event) => updateFilters({ effectiveDate: event.target.value })}
              className={cn(fieldControlClass, fieldBorderClass(false))}
            />
          </FormField>
          <FilterSelect
            id="pd-expiringWithinDays"
            label="Expiry window"
            value={filters.expiringWithinDays}
            allLabel="Any expiry"
            options={EXPIRY_WINDOWS.map((days) => ({ value: String(days), label: `Expires within ${days} days` }))}
            onChange={(value) => updateFilters({ expiringWithinDays: value })}
          />
        </div>
        {filtersApplied ? (
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => updateFilters(EMPTY_FILTERS)}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear filters
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-label="Pricing rules" aria-busy={state === "loading"} className="flex flex-col gap-4">
        {state === "error" ? (
          <ErrorState
            title="Couldn't load the pricing dashboard"
            description={errorMessage}
            action={
              <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
                Try again
              </Button>
            }
          />
        ) : state === "loading" && !data ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title={filtersApplied ? "No pricing rules match these filters" : "No pricing rules yet"}
            description={filtersApplied ? "Try widening or clearing the filters." : "Create rules under Admin → Pricing."}
            action={
              filtersApplied ? (
                <Button type="button" size="sm" onClick={() => updateFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              ) : (
                <Link href="/admin/pricing" className="text-sm font-medium text-ink-accent underline-offset-2 hover:underline">
                  Go to Pricing
                </Link>
              )
            }
          />
        ) : data ? (
          <>
            <div className={cn("overflow-x-auto rounded-xl border border-hairline bg-surface-1", state === "loading" && "opacity-60")}>
              <table className="w-full min-w-[64rem] text-sm">
                <thead className="bg-surface-2 text-left text-xs text-ink-tertiary">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-medium">Service</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Country</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Visa type</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Processing</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Passenger</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Selling</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Extra charges</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Vendor cost</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Margin</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Validity</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="border-t border-hairline align-top">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-ink-primary">{SERVICE_TYPE_LABELS[row.serviceType]}</div>
                        <div className="text-xs text-ink-tertiary">{row.subService?.name ?? "All sub-services"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-secondary">{row.country?.name ?? "All countries"}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">{row.visaType?.name ?? "Any"}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">{row.processingLabel ?? "Any"}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">
                        <div>{PAX_TYPE_LABELS[row.paxType]}</div>
                        <div className="text-xs text-ink-tertiary">{row.nationality ?? "All nationalities"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-primary">{money(row.sellingPrice)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">{money(row.additionalCharges)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">{money(row.vendorCost)}</td>
                      <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", row.margin < 0 ? "text-error" : "text-ink-primary")}>
                        {money(row.margin)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-secondary">
                        {formatDate(row.validityFrom)} – {formatDate(row.validityUntil)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CLASSES[row.status])}>{STATUS_LABELS[row.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-tertiary">Margin = selling price + extra charges − vendor cost (internal).</p>
            <ListPagination
              noun="pricing rule"
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              itemCount={data.items.length}
              disabled={state === "loading"}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
