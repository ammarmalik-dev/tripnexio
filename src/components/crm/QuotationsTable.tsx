"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, RotateCw } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { DateRangeFilter } from "./DateRangeFilter";
import { useDateRangeFilter } from "./useDateRangeFilter";
import { ExportCsvButton } from "./ExportCsvButton";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { ListPagination } from "./ListPagination";
import { usePaginationState } from "./usePagination";
import { useListFilterOptions } from "./useListFilterOptions";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

type QuotationStatus = "SELECTED" | "EXPIRED" | "PENDING";

const STATUS_LABELS: Record<QuotationStatus, string> = {
  SELECTED: "Selected",
  EXPIRED: "Expired",
  PENDING: "Pending",
};

const STATUS_STYLES: Record<QuotationStatus, string> = {
  SELECTED: "bg-success/10 text-success",
  EXPIRED: "bg-error/10 text-error",
  PENDING: "bg-ink-primary/[0.06] text-ink-secondary",
};

const STATUS_OPTIONS: { value: QuotationStatus; label: string }[] = (
  Object.entries(STATUS_LABELS) as [QuotationStatus, string][]
).map(([value, label]) => ({ value, label }));

interface QuotationListItem {
  id: string;
  leadId: string;
  leadReferenceId: string;
  serviceType: ServiceType;
  status: QuotationStatus;
  sellingPrice: string;
  margin: string | null;
  customer: { name: string; mobile: string; email: string | null };
  countryName: string | null;
  countryFlag: string | null;
  paxCount: number | null;
  subService: string | null;
  serviceDetails: string | null;
  travelDate: string | null;
  poc: { name: string; active: boolean } | null;
  createdAt: string;
}

interface QuotationListResponse {
  items: QuotationListItem[];
  total: number;
  page: number;
  pageSize: number;
}

type SortOption = "createdAt_desc" | "createdAt_asc";
type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDay(day: string | null): string {
  return day
    ? new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "—";
}

function money(value: string): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export function QuotationsTable() {
  // Step 53 — read once on mount, so a Command Centre KPI card's link lands pre-filtered.
  const searchParams = useSearchParams();
  const [serviceType, setServiceType] = useState(() => searchParams.get("serviceType") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear: clearDates } = useDateRangeFilter(
    searchParams.get("dateFrom") ?? "",
    searchParams.get("dateTo") ?? ""
  );
  // Client corrections 2026-10-05 — POC, country and travel-date filters; no page search box (global 360 search).
  const [assignedStaffId, setAssignedStaffId] = useState(() => searchParams.get("assignedStaffId") ?? "");
  const [countryId, setCountryId] = useState(() => searchParams.get("countryId") ?? "");
  const [travelFrom, setTravelFrom] = useState(() => searchParams.get("travelFrom") ?? "");
  const [travelTo, setTravelTo] = useState(() => searchParams.get("travelTo") ?? "");
  const [search] = useState(() => searchParams.get("search") ?? "");
  const filterOptions = useListFilterOptions();
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<QuotationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { page, pageSize, resetPage, paginationHandlers } = usePaginationState();

  function buildFilterParams() {
    const params = new URLSearchParams();
    if (serviceType) params.set("serviceType", serviceType);
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (assignedStaffId) params.set("assignedStaffId", assignedStaffId);
    if (countryId) params.set("countryId", countryId);
    if (travelFrom) params.set("travelFrom", travelFrom);
    if (travelTo) params.set("travelTo", travelTo);
    if (search) params.set("search", search);
    params.set("sort", sort);
    return params;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadQuotations() {
      setState("loading");
      try {
        const params = buildFilterParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const result = await getJson<QuotationListResponse>(`/api/quotations?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load quotations. Please try again.");
        setState("error");
      }
    }

    void loadQuotations();
    return () => {
      cancelled = true;
    };
    // buildFilterParams reads exactly the state listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, status, assignedStaffId, countryId, travelFrom, travelTo, dateFrom, dateTo, search, sort, page, pageSize, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="filter-quote-poc" className="sr-only">
          Filter by POC
        </label>
        <select
          id="filter-quote-poc"
          value={assignedStaffId}
          onChange={(event) => {
            setAssignedStaffId(event.target.value);
            resetPage();
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]")}
        >
          <option value="">All POCs</option>
          <option value="unassigned">Unassigned</option>
          {filterOptions.staff.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="filter-quote-country" className="sr-only">
          Filter by country
        </label>
        <select
          id="filter-quote-country"
          value={countryId}
          onChange={(event) => {
            setCountryId(event.target.value);
            resetPage();
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]")}
        >
          <option value="">All countries</option>
          {filterOptions.countries.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <label htmlFor="filter-quote-travel-from" className="text-xs text-ink-tertiary">
            Travel
          </label>
          <input
            id="filter-quote-travel-from"
            type="date"
            aria-label="Travel date from"
            value={travelFrom}
            onChange={(event) => {
              setTravelFrom(event.target.value);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "w-auto")}
          />
          <span className="text-xs text-ink-tertiary">to</span>
          <input
            type="date"
            aria-label="Travel date to"
            value={travelTo}
            onChange={(event) => {
              setTravelTo(event.target.value);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "w-auto")}
          />
        </div>

        <label htmlFor="filter-quotation-service" className="sr-only">
          Filter by service
        </label>
        <select
          id="filter-quotation-service"
          value={serviceType}
          onChange={(event) => {
            setServiceType(event.target.value);
            resetPage();
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[160px]")}
        >
          <option value="">All services</option>
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="filter-quotation-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-quotation-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetPage();
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]")}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="sort-quotations" className="sr-only">
          Sort by created date
        </label>
        <select
          id="sort-quotations"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as SortOption);
            resetPage();
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[160px]")}
        >
          <option value="createdAt_desc">Newest first</option>
          <option value="createdAt_asc">Oldest first</option>
        </select>

        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => setRefreshNonce((current) => current + 1)}
          disabled={state === "loading"}
        >
          <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>

        <ExportCsvButton href={`/api/quotations/export?${buildFilterParams().toString()}`} />
      </div>

      <DateRangeFilter
        idPrefix="quotation"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPreset={(days) => {
          applyPreset(days);
          resetPage();
        }}
        onCustomFrom={(dateOnly) => {
          applyCustomFrom(dateOnly);
          resetPage();
        }}
        onCustomTo={(dateOnly) => {
          applyCustomTo(dateOnly);
          resetPage();
        }}
        onClear={() => {
          clearDates();
          resetPage();
        }}
      />

      {state === "loading" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load quotations"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setRefreshNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state === "success" && items.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          title="No quotations match these filters"
          description="Try different filters, or clear them."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[1400px] border-collapse text-sm">
            <thead>
              {/* Client testing 2026-10-09 (E13) — same layout as the Bookings table. */}
              <tr className="border-b border-hairline text-left text-xs font-semibold text-ink-secondary">
                <th className="px-4 py-3">Lead ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">
                  Service
                  <span className="block font-normal text-ink-tertiary">Sub-Service</span>
                </th>
                <th className="px-4 py-3">Service Details</th>
                <th className="px-4 py-3">Travel Date</th>
                <th className="px-4 py-3">POC</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Selling Price</th>
                {items.some((item) => item.margin !== null) ? (
                  <th className="px-4 py-3">
                    Margin <span className="text-[10px] normal-case text-ink-tertiary">(internal)</span>
                  </th>
                ) : null}
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((quotation) => (
                <tr key={quotation.id} className="border-b border-hairline align-top last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/crm/leads/${quotation.leadId}#tab-quotation`} className="font-semibold text-ink-accent hover:underline">
                      {quotation.leadReferenceId}
                    </Link>
                    <span className="block text-xs text-ink-tertiary">{quotation.paxCount ?? "—"} PAX</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink-heading">{quotation.customer.name}</span>
                    {quotation.customer.email ? <span className="block text-xs text-ink-tertiary">{quotation.customer.email}</span> : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">{quotation.customer.mobile}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">
                    {quotation.countryName ? (
                      <span className="inline-flex items-center gap-1.5">
                        {quotation.countryFlag ? (
                          <span className="text-base leading-none" aria-hidden="true">
                            {quotation.countryFlag}
                          </span>
                        ) : null}
                        {quotation.countryName}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink-heading">{SERVICE_TYPE_LABELS[quotation.serviceType]}</span>
                    {quotation.subService ? <span className="block text-xs text-ink-tertiary">{quotation.subService}</span> : null}
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 text-ink-secondary">{quotation.serviceDetails ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">{formatDay(quotation.travelDate)}</td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {quotation.poc ? (quotation.poc.active ? quotation.poc.name : `Unassigned (was ${quotation.poc.name})`) : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                        STATUS_STYLES[quotation.status]
                      )}
                    >
                      {STATUS_LABELS[quotation.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{money(quotation.sellingPrice)}</td>
                  {quotation.margin !== null ? (
                    <td className="px-4 py-3">
                      <span title="Internal — never shown to the customer" className="text-ink-tertiary decoration-dotted underline-offset-2">
                        {money(quotation.margin)} (internal)
                      </span>
                    </td>
                  ) : null}
                  <td className="px-4 py-3 whitespace-nowrap text-ink-tertiary">{formatDate(quotation.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/crm/leads/${quotation.leadId}#tab-quotation`} className="font-medium text-ink-accent hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <ListPagination
          noun="quotation"
          page={page}
          pageSize={pageSize}
          total={total}
          itemCount={items.length}
          {...paginationHandlers}
        />
      ) : null}
    </div>
  );
}
