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
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LeadTemperatureBadge } from "./LeadTemperatureBadge";
import { UrgentBadge } from "./UrgentBadge";
import { ListPagination } from "./ListPagination";
import { usePaginationState } from "./usePagination";
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

export function LeadsTable() {
  // Step 53 — read once on mount, so a Command Centre KPI card's link
  // (e.g. /crm/leads?status=NEW&dateFrom=...&dateTo=...) lands pre-filtered.
  const searchParams = useSearchParams();
  const [serviceType, setServiceType] = useState(() => searchParams.get("serviceType") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
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
    if (search) params.set("search", search);
    params.set("sort", sort);
    return params;
  }

  useEffect(() => {
    // Only fires after searchInput actually changes (plus once on mount,
    // when page is already 1), so resetting the page here never undoes a
    // Prev/Next click.
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadLeads() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (serviceType) params.set("serviceType", serviceType);
        if (status) params.set("status", status);
        if (temperature) params.set("temperature", temperature);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (search) params.set("search", search);
        if (paymentFailed) params.set("paymentFailed", "1");
        params.set("sort", sort);
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
  }, [serviceType, status, temperature, paymentFailed, dateFrom, dateTo, search, sort, page, pageSize, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="lead-search" className="sr-only">
            Search by customer name or mobile
          </label>
          <input
            id="lead-search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by customer name or mobile…"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>

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
          description="Try a different search term or clear the filters."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Temperature</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/leads/${lead.id}`} className="text-ink-accent hover:underline">
                      {lead.referenceId}
                    </Link>
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
                    <div className="flex flex-col">
                      <span className="font-medium text-ink-primary">{lead.customer.name}</span>
                      <span className="text-xs text-ink-tertiary">{lead.customer.mobile}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{SERVICE_TYPE_LABELS[lead.serviceType]}</td>
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
                  <td className="px-4 py-3 text-ink-tertiary">{formatDate(lead.createdAt)}</td>
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
