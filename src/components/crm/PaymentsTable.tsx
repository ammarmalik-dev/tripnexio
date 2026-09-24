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
import { DashboardFilterChip } from "./DashboardFilterChip";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PAYMENT_STATUS_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { PaymentStatus } from "../../generated/prisma/enums";

interface PaymentListItem {
  id: string;
  amount: string;
  gstAmount: string;
  gatewayFee: string;
  status: PaymentStatus;
  gatewayRef: string | null;
  createdAt: string;
  bookingId: string;
  bookingDisplayId: string;
  leadReferenceId: string;
  customer: { name: string; mobile: string };
}

interface PaymentListResponse {
  items: PaymentListItem[];
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

export function PaymentsTable() {
  // Step 53 — read once on mount, so a Command Centre KPI card's link lands pre-filtered.
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [dateFrom] = useState(() => searchParams.get("dateFrom") ?? "");
  const [dateTo] = useState(() => searchParams.get("dateTo") ?? "");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<PaymentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [markingId, setMarkingId] = useState<string | null>(null);

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
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (search) params.set("search", search);
        params.set("sort", sort);

        const result = await getJson<PaymentListResponse>(`/api/payments?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load payments. Please try again.");
        setState("error");
      }
    }

    void loadPayments();
    return () => {
      cancelled = true;
    };
  }, [status, dateFrom, dateTo, search, sort, refreshNonce]);

  const handleMarkSuccess = async (id: string) => {
    setMarkingId(id);
    try {
      await postJson(`/api/payments/${id}/mark-success`, {});
      toast.success("Payment marked successful.");
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't mark this payment successful. Please try again.");
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="payment-search" className="sr-only">
            Search by booking id, gateway ref, customer name, or mobile
          </label>
          <input
            id="payment-search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by booking id, customer name, or mobile…"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>

        <label htmlFor="filter-payment-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-payment-status"
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

        <label htmlFor="sort-payments" className="sr-only">
          Sort by created date
        </label>
        <select
          id="sort-payments"
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

      <DashboardFilterChip dateFrom={dateFrom} dateTo={dateTo} clearHref="/crm/payments" />

      {state === "loading" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load payments"
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
          title="No payments match these filters"
          description="Try a different search term or clear the filters."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">GST</th>
                <th className="px-4 py-3">Gateway Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
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
                  <td className="px-4 py-3 text-ink-secondary">{money(payment.amount)}</td>
                  <td className="px-4 py-3 text-ink-secondary">{money(payment.gstAmount)}</td>
                  <td className="px-4 py-3 text-ink-secondary">{money(payment.gatewayFee)}</td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatDate(payment.createdAt)}</td>
                  <td className="px-4 py-3">
                    {payment.status === "PENDING" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleMarkSuccess(payment.id)}
                        isLoading={markingId === payment.id}
                      >
                        Mark Success
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <p className="text-xs text-ink-tertiary">
          Showing {items.length} of {total} payment{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
