"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, RotateCw, Download } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PAYMENT_STATUS_OPTIONS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { PaymentStatus } from "../../generated/prisma/enums";

interface ExtraPaymentListItem {
  id: string;
  amount: string;
  gstAmount: string;
  gatewayFee: string;
  status: PaymentStatus;
  description: string | null;
  createdAt: string;
  bookingId: string;
  bookingDisplayId: string;
  leadReferenceId: string;
  customer: { name: string; mobile: string };
}

interface ExtraPaymentListResponse {
  items: ExtraPaymentListItem[];
  total: number;
}

type SortOption = "createdAt_desc" | "createdAt_asc";
type FetchState = "loading" | "success" | "error";

function money(value: string): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Step 52 — "Show extra-payment transactions in their own filterable,
 * CSV-exportable report, separate from the primary per-booking payment
 * list." `refreshSignal` lets the parent page (after creating a new one
 * via `ExtraPaymentLookupForm`) tell this list to reload without prop-
 * drilling a shared fetch.
 */
export function ExtraPaymentsTable({ refreshSignal }: { refreshSignal: number }) {
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<ExtraPaymentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadPayments() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (search) params.set("search", search);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        params.set("sort", sort);

        const result = await getJson<ExtraPaymentListResponse>(`/api/payments/extra?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load extra payments. Please try again.");
        setState("error");
      }
    }

    void loadPayments();
    return () => {
      cancelled = true;
    };
  }, [status, search, dateFrom, dateTo, sort, refreshNonce, refreshSignal]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="extra-payment-search" className="sr-only">
            Search by booking id, reason, customer name, or mobile
          </label>
          <input
            id="extra-payment-search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by booking id, reason, customer, or mobile…"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>

        <label htmlFor="filter-extra-payment-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-extra-payment-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[150px]")}
        >
          <option value="">All statuses</option>
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="extra-payment-date-from" className="sr-only">
          From date
        </label>
        <input
          id="extra-payment-date-from"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto")}
        />
        <label htmlFor="extra-payment-date-to" className="sr-only">
          To date
        </label>
        <input
          id="extra-payment-date-to"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto")}
        />

        <label htmlFor="sort-extra-payments" className="sr-only">
          Sort by created date
        </label>
        <select
          id="sort-extra-payments"
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

        <a
          href="/api/payments/extra/export"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline px-4 text-sm font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border hover:bg-white/[0.03]"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </a>
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
          title="Couldn't load extra payments"
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
          title="No extra payments match these filters"
          description="Try a different search term or clear the filters."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((payment) => (
                <tr key={payment.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/bookings/${payment.bookingId}`} className="text-ink-accent hover:underline">
                      {payment.bookingDisplayId}
                    </Link>
                    <div className="text-xs text-ink-tertiary">{payment.leadReferenceId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-ink-primary">{payment.customer.name}</span>
                      <span className="text-xs text-ink-tertiary">{payment.customer.mobile}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{payment.description}</td>
                  <td className="px-4 py-3 text-ink-secondary">{money(payment.amount)}</td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatDate(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <p className="text-xs text-ink-tertiary">
          Showing {items.length} of {total} extra payment{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
