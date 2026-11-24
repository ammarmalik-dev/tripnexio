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
import { usePaginationState } from "@/components/crm/usePagination";
import { PAX_TYPE_LABELS } from "@/lib/crm/labels";
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
  /** Client doc 16 Nov (K9) — the country's visa product (e.g. 30 Days · Single Entry · Tourist). */
  product: { id: string; label: string } | null;
  vendorCostSource: "VENDOR_RATE" | "RULE";
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
  products: { id: string; countryId: string; label: string; active: boolean }[];
  nationalities: { id: string; name: string; active: boolean }[];
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
  newVisaConfigId: string;
  processingType: string;
  nationalityId: string;
  active: "" | "true" | "false";
  status: RuleStatus | "";
  effectiveDate: string;
  expiringWithinDays: string;
}

const EMPTY_FILTERS: Filters = {
  countryId: "",
  newVisaConfigId: "",
  processingType: "",
  nationalityId: "",
  active: "",
  status: "",
  effectiveDate: "",
  expiringWithinDays: "",
};

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

function buildQuery(filters: Filters, page: number, pageSize: number): string {
  // Client doc 16 Nov (K9) — the Visa Price Table shows visa (New Visa) prices only.
  const params = new URLSearchParams({ serviceType: "NEW_VISA" });
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
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
  const { page, pageSize, setPage, paginationHandlers } = usePaginationState();
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
        const result = await getJson<DashboardResponse>(`/api/admin/pricing-dashboard?${buildQuery(filters, page, pageSize)}${needsOptions ? "&includeOptions=1" : ""}`);
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
  }, [filters, page, pageSize, reloadNonce]);

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const countryName = new Map((options?.countries ?? []).map((entry) => [entry.id, entry.name]));
  // Client doc 16 Nov (K9) — the products configured for the chosen country (all countries: with the country name).
  const productOptions = (options?.products ?? [])
    .filter((entry) => !filters.countryId || entry.countryId === filters.countryId)
    .map((entry) => ({ value: entry.id, label: `${filters.countryId ? "" : `${countryName.get(entry.countryId) ?? ""} — `}${entry.label}${entry.active ? "" : " (inactive)"}` }));
  const nationalityOptions = (options?.nationalities ?? []).map((entry) => ({ value: entry.id, label: `${entry.name}${entry.active ? "" : " — inactive"}` }));
  const processingOptions = [
    ...new Map(
      (options?.processingTypes ?? [])
        .filter((entry) => entry.serviceType === "NEW_VISA")
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
            id="pd-countryId"
            label="Country"
            value={filters.countryId}
            allLabel="All countries"
            options={(options?.countries ?? []).map((entry) => ({ value: entry.id, label: `${entry.name}${entry.active ? "" : " — inactive"}` }))}
            onChange={(value) => updateFilters({ countryId: value, newVisaConfigId: "" })}
          />
          <FilterSelect
            id="pd-newVisaConfigId"
            label="Visa product type"
            value={filters.newVisaConfigId}
            allLabel="All visa products"
            options={productOptions}
            disabled={productOptions.length === 0}
            onChange={(value) => updateFilters({ newVisaConfigId: value })}
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
            id="pd-nationalityId"
            label="Nationality"
            value={filters.nationalityId}
            allLabel="All nationalities"
            options={nationalityOptions}
            disabled={nationalityOptions.length === 0}
            onChange={(value) => updateFilters({ nationalityId: value })}
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
            title={filtersApplied ? "No visa prices match these filters" : "No visa prices yet"}
            description={filtersApplied ? "Try widening or clearing the filters." : "Set visa prices under Admin → Pricing (New Visa price form)."}
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
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="bg-surface-2 text-left text-xs text-ink-tertiary">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-medium">Country</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Visa product type</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Processing</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Passenger</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Visa price</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Vendor cost</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Margin</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Validity</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="border-t border-hairline align-top">
                      <td className="px-3 py-2.5 font-medium text-ink-primary">{row.country?.name ?? "All countries"}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">{row.product?.label ?? "Every product"}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">{row.processingLabel ?? "Any"}</td>
                      <td className="px-3 py-2.5 text-ink-secondary">
                        <div>{PAX_TYPE_LABELS[row.paxType]}</div>
                        <div className="text-xs text-ink-tertiary">{row.nationality ?? "All nationalities"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-primary">{money(row.totalPrice)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                        <div>{money(row.vendorCost)}</div>
                        <div className="text-xs text-ink-tertiary">{row.vendorCostSource === "VENDOR_RATE" ? "lowest vendor rate" : "no vendor rate"}</div>
                      </td>
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
            <ListPagination
              noun="visa price"
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              itemCount={data.items.length}
              disabled={state === "loading"}
              {...paginationHandlers}
            />
            <p className="text-xs text-ink-tertiary">
              Vendor cost = the lowest matching vendor rate (Admin → Vendor rates), the same one checkout uses; without one, the price form&apos;s own vendor cost. Margin = visa price − vendor cost (internal).
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
