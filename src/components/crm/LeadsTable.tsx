"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, RotateCw } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LeadTemperatureBadge } from "./LeadTemperatureBadge";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS, LEAD_STATUS_OPTIONS, LEAD_TEMPERATURE_OPTIONS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceType, LeadStatus, LeadTemperature } from "../../generated/prisma/enums";

interface LeadListItem {
  id: string;
  referenceId: string;
  serviceType: ServiceType;
  status: LeadStatus;
  temperature: LeadTemperature | null;
  source: string | null;
  createdAt: string;
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
  const [serviceType, setServiceType] = useState("");
  const [status, setStatus] = useState("");
  const [temperature, setTemperature] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadLeads() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (serviceType) params.set("serviceType", serviceType);
        if (status) params.set("status", status);
        if (temperature) params.set("temperature", temperature);
        if (search) params.set("search", search);
        params.set("sort", sort);

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
  }, [serviceType, status, temperature, search, sort, refreshNonce]);

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
          onChange={(event) => setServiceType(event.target.value)}
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
          onChange={(event) => setStatus(event.target.value)}
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
          onChange={(event) => setTemperature(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]")}
        >
          <option value="">All temperatures</option>
          {LEAD_TEMPERATURE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="sort-leads" className="sr-only">
          Sort by created date
        </label>
        <select
          id="sort-leads"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
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
      </div>

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
        <p className="text-xs text-ink-tertiary">
          Showing {items.length} of {total} lead{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
