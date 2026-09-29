"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, RotateCw, Inbox } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { LeadStatus, ServiceType } from "../../generated/prisma/enums";

const AWAITING_SERVICE_OPTIONS: { value: ServiceType; label: string }[] = (
  ["FLIGHT_SPECIAL_FARE", "VISA_EXTENSION", "VISA_CHANGE"] as const
).map((value) => ({ value, label: SERVICE_TYPE_LABELS[value] }));

interface AwaitingQuotationItem {
  leadId: string;
  leadReferenceId: string;
  serviceType: ServiceType;
  status: LeadStatus;
  source: string | null;
  customer: { name: string; mobile: string };
  createdAt: string;
}

interface AwaitingQuotationResponse {
  items: AwaitingQuotationItem[];
  total: number;
  page: number;
  pageSize: number;
}

type FetchState = "loading" | "success" | "error";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * P21 — Flight Special Fare / Visa Extension / Visa Change full-form
 * submissions that still have no quotation (GET /api/quotations/awaiting).
 * Each row opens the lead page, where the quote builder lives.
 */
export function AwaitingQuotationsTable() {
  const [serviceType, setServiceType] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<AwaitingQuotationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadAwaiting() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (serviceType) params.set("serviceType", serviceType);
        if (search) params.set("search", search);
        const result = await getJson<AwaitingQuotationResponse>(`/api/quotations/awaiting?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the queue. Please try again.");
        setState("error");
      }
    }

    void loadAwaiting();
    return () => {
      cancelled = true;
    };
  }, [serviceType, search, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="awaiting-search" className="sr-only">
            Search by reference, customer name or mobile
          </label>
          <input
            id="awaiting-search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by reference, name or mobile…"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>

        <label htmlFor="filter-awaiting-service" className="sr-only">
          Filter by service
        </label>
        <select
          id="filter-awaiting-service"
          value={serviceType}
          onChange={(event) => setServiceType(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[160px]")}
        >
          <option value="">All quote services</option>
          {AWAITING_SERVICE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <Button type="button" variant="ghost" size="md" onClick={() => setRefreshNonce((current) => current + 1)} disabled={state === "loading"}>
          <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load the awaiting-quotation queue"
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
          icon={<Inbox className="h-5 w-5" aria-hidden="true" />}
          title="Nothing awaiting a quotation"
          description="Every open Flight Special Fare, Visa Extension and Visa Change request already has a quote."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Lead status</th>
                <th className="px-4 py-3">Quotation</th>
                <th className="px-4 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.leadId} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/leads/${item.leadId}`} className="text-ink-accent hover:underline">
                      {item.leadReferenceId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-ink-primary">{item.customer.name}</span>
                      <span className="text-xs text-ink-tertiary">{item.customer.mobile}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{SERVICE_TYPE_LABELS[item.serviceType]}</td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                      Awaiting quotation
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatDateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <p className="text-xs text-ink-tertiary">
          Showing {items.length} of {total} lead{total === 1 ? "" : "s"} awaiting a quotation
        </p>
      ) : null}
    </div>
  );
}
