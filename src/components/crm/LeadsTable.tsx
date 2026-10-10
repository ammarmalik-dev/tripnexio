"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, RotateCw, ArrowRight } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { DateRangeFilter } from "./DateRangeFilter";
import { useDateRangeFilter } from "./useDateRangeFilter";
import { ExportCsvButton } from "./ExportCsvButton";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LeadTemperatureBadge } from "./LeadTemperatureBadge";
import { UrgentBadge } from "./UrgentBadge";
import { ListPagination } from "./ListPagination";
import { usePaginationState } from "./usePagination";
import { useListFilterOptions } from "./useListFilterOptions";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS, LEAD_STATUS_OPTIONS, LEAD_TEMPERATURE_OPTIONS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceType, LeadStatus, LeadTemperature, PaymentStatus } from "../../generated/prisma/enums";

interface LeadListItem {
  id: string;
  referenceId: string;
  serviceType: ServiceType;
  status: LeadStatus;
  temperature: LeadTemperature | null;
  source: string | null;
  createdAt: string;
  countryName: string | null;
  countryFlag: string | null;
  serviceDetails: string | null;
  travelDate: string | null;
  paxCount: number | null;
  subService: string | null;
  urgent: boolean;
  abandoned: boolean;
  paymentFailedStatus: PaymentStatus | null;
  customer: { name: string; mobile: string; email: string | null };
  assignedStaff: { id: string; name: string; active: boolean } | null;
}

interface LeadListResponse {
  items: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
}

type SortOption = "createdAt_desc" | "createdAt_asc";

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTravelDate(value: string | null): string {
  return value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "—";
}

/** `defaultStatus` pre-filters the list (e.g. the Follow-ups screen). */
export function LeadsTable({ defaultStatus = "" }: { defaultStatus?: string } = {}) {
  // Step 53 — read once on mount, so a Command Centre KPI card's link
  // (e.g. /crm/leads?status=NEW&dateFrom=...&dateTo=...) lands pre-filtered.
  const searchParams = useSearchParams();
  const [serviceType, setServiceType] = useState(() => searchParams.get("serviceType") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? defaultStatus);
  // Client corrections 2026-10-05 — POC, country and travel-date filters.
  const [assignedStaffId, setAssignedStaffId] = useState(() => searchParams.get("assignedStaffId") ?? "");
  const [countryId, setCountryId] = useState(() => searchParams.get("countryId") ?? "");
  const [travelFrom, setTravelFrom] = useState(() => searchParams.get("travelFrom") ?? "");
  const [travelTo, setTravelTo] = useState(() => searchParams.get("travelTo") ?? "");
  const filterOptions = useListFilterOptions();
  const [temperature, setTemperature] = useState(() => searchParams.get("temperature") ?? "");
  const [paymentFailed, setPaymentFailed] = useState(() => searchParams.get("paymentFailed") === "1");
  const { page, pageSize, setPage, paginationHandlers } = usePaginationState();
  const {
    dateFrom,
    dateTo,
    applyPreset: applyPresetRaw,
    applyCustomFrom: applyCustomFromRaw,
    applyCustomTo: applyCustomToRaw,
    clear: clearDatesRaw,
  } = useDateRangeFilter(
    searchParams.get("dateFrom") ?? "",
    searchParams.get("dateTo") ?? ""
  );
  // One global 360 search in the top bar (client corrections 2026-10-05), so
  // no search box here; a ?search= link still lands pre-filtered.
  const [search] = useState(() => searchParams.get("search") ?? "");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Any filter/search/sort change goes back to page 1 — set alongside the
  // filter itself (in the event handler), never from an effect.
  function applyPreset(days: number) {
    applyPresetRaw(days);
    setPage(1);
  }
  function applyCustomFrom(dateOnly: string) {
    applyCustomFromRaw(dateOnly);
    setPage(1);
  }
  function applyCustomTo(dateOnly: string) {
    applyCustomToRaw(dateOnly);
    setPage(1);
  }
  function clearDates() {
    clearDatesRaw();
    setPage(1);
  }

  function buildFilterParams() {
    const params = new URLSearchParams();
    if (serviceType) params.set("serviceType", serviceType);
    if (status) params.set("status", status);
    if (temperature) params.set("temperature", temperature);
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

    async function loadLeads() {
      setState("loading");
      try {
        const params = buildFilterParams();
        if (paymentFailed) params.set("paymentFailed", "1");
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const result = await getJson<LeadListResponse>(`/api/leads?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load leads. Please try again.");
        setState("error");
      }
    }

    void loadLeads();
    return () => {
      cancelled = true;
    };
    // buildFilterParams reads exactly the state listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, status, temperature, paymentFailed, assignedStaffId, countryId, travelFrom, travelTo, dateFrom, dateTo, search, sort, page, pageSize, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="filter-service" className="sr-only">
          Filter by service
        </label>
        <select
          id="filter-service"
          value={serviceType}
          onChange={(event) => {
            setServiceType(event.target.value);
            setPage(1);
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

        <label htmlFor="filter-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]")}
        >
          <option value="">All statuses</option>
          {LEAD_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="filter-temperature" className="sr-only">
          Filter by temperature
        </label>
        <select
          id="filter-temperature"
          value={temperature}
          onChange={(event) => {
            setTemperature(event.target.value);
            setPage(1);
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]")}
        >
          <option value="">All temperatures</option>
          {LEAD_TEMPERATURE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="filter-payment-failed" className="sr-only">
          Filter by payment outcome
        </label>
        <select
          id="filter-payment-failed"
          value={paymentFailed ? "1" : ""}
          onChange={(event) => {
            setPaymentFailed(event.target.value === "1");
            setPage(1);
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[160px]")}
        >
          <option value="">All payments</option>
          <option value="1">Payment failed</option>
        </select>

        <label htmlFor="filter-poc" className="sr-only">
          Filter by POC
        </label>
        <select
          id="filter-poc"
          value={assignedStaffId}
          onChange={(event) => {
            setAssignedStaffId(event.target.value);
            setPage(1);
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

        <label htmlFor="filter-country" className="sr-only">
          Filter by country
        </label>
        <select
          id="filter-country"
          value={countryId}
          onChange={(event) => {
            setCountryId(event.target.value);
            setPage(1);
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
          <label htmlFor="filter-travel-from" className="text-xs text-ink-tertiary">
            Travel
          </label>
          <input
            id="filter-travel-from"
            type="date"
            aria-label="Travel date from"
            value={travelFrom}
            onChange={(event) => {
              setTravelFrom(event.target.value);
              setPage(1);
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
              setPage(1);
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "w-auto")}
          />
        </div>

        <label htmlFor="sort-leads" className="sr-only">
          Sort by created date
        </label>
        <select
          id="sort-leads"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as SortOption);
            setPage(1);
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

        <ExportCsvButton href={`/api/leads/export?${buildFilterParams().toString()}`} />
      </div>

      <DateRangeFilter
        idPrefix="lead"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPreset={applyPreset}
        onCustomFrom={applyCustomFrom}
        onCustomTo={applyCustomTo}
        onClear={clearDates}
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
          title="Couldn't load leads"
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
          title="No leads match these filters"
          description="Try different filters, or clear them."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[1250px] border-collapse text-sm">
            <thead>
              {/* Client testing 2026-10-09 (E13) — same layout as the Bookings table: Title Case, PAX under the ID. */}
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Temperature</th>
                <th className="px-4 py-3">POC</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id} className="border-b border-hairline align-top last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/crm/leads/${lead.id}`} className="font-semibold text-ink-accent hover:underline">
                      {lead.referenceId}
                    </Link>
                    <span className="block text-xs text-ink-tertiary">{lead.paxCount ?? "—"} PAX</span>
                    {lead.urgent || lead.paymentFailedStatus || lead.abandoned ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lead.abandoned ? (
                          <span
                            className="inline-flex items-center whitespace-nowrap rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                            title="Contact details only — the customer left the website form after step 1"
                          >
                            Abandoned
                          </span>
                        ) : null}
                        {lead.urgent ? <UrgentBadge serviceType={lead.serviceType} /> : null}
                        {lead.paymentFailedStatus ? (
                          <span
                            className="inline-flex items-center whitespace-nowrap rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error"
                            title={
                              lead.paymentFailedStatus === "EXPIRED"
                                ? "Latest payment link expired unpaid"
                                : "Latest payment attempt failed"
                            }
                          >
                            Payment failed
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink-heading">{lead.customer.name}</span>
                    {lead.customer.email ? <span className="block text-xs text-ink-tertiary">{lead.customer.email}</span> : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">{lead.customer.mobile}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">
                    {lead.countryName ? (
                      <span className="inline-flex items-center gap-1.5">
                        {lead.countryFlag ? (
                          <span className="text-base leading-none" aria-hidden="true">
                            {lead.countryFlag}
                          </span>
                        ) : null}
                        {lead.countryName}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink-heading">{SERVICE_TYPE_LABELS[lead.serviceType]}</span>
                    {lead.subService ? <span className="block text-xs text-ink-tertiary">{lead.subService}</span> : null}
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 text-ink-secondary">{lead.serviceDetails ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">{formatTravelDate(lead.travelDate)}</td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">
                    <LeadTemperatureBadge temperature={lead.temperature} />
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {lead.assignedStaff === null ? (
                      "Unassigned"
                    ) : lead.assignedStaff.active ? (
                      lead.assignedStaff.name
                    ) : (
                      <span title={`Previously assigned to ${lead.assignedStaff.name}, now inactive`}>
                        Unassigned <span className="text-xs text-ink-tertiary">(was: {lead.assignedStaff.name})</span>
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-tertiary">{formatDate(lead.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/crm/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-ink-accent hover:underline"
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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
          noun="lead"
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
