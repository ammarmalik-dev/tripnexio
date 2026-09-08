"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, RotateCw } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { RefundStatusControl } from "./RefundStatusControl";
import { REFUND_STATUS_OPTIONS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { RefundStatus } from "../../generated/prisma/enums";

interface RefundListItem {
  id: string;
  paidAmount: string;
  cancellationCharge: string;
  gatewayCharge: string;
  refundAmount: string;
  reason: string | null;
  status: RefundStatus;
  createdAt: string;
  paymentId: string;
  bookingDisplayId: string;
  leadReferenceId: string;
  customer: { name: string; mobile: string };
}

interface RefundListResponse {
  items: RefundListItem[];
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

export function RefundsTable({ canApproveRefunds }: { canApproveRefunds: boolean }) {
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<RefundListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, RefundStatus>>({});

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadRefunds() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (search) params.set("search", search);
        params.set("sort", sort);

        const result = await getJson<RefundListResponse>(`/api/refunds?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setStatusOverrides({});
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load refunds. Please try again.");
        setState("error");
      }
    }

    void loadRefunds();
    return () => {
      cancelled = true;
    };
  }, [status, search, sort, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="refund-search" className="sr-only">
            Search by booking id, customer name, or mobile
          </label>
          <input
            id="refund-search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by booking id, customer name, or mobile…"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>

        <label htmlFor="filter-refund-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-refund-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[150px]")}
        >
          <option value="">All statuses</option>
          {REFUND_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="sort-refunds" className="sr-only">
          Sort by created date
        </label>
        <select
          id="sort-refunds"
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
          title="Couldn't load refunds"
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
          title="No refunds match these filters"
          description="Refunds are recorded from a successful payment's detail panel."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Breakdown</th>
                <th className="px-4 py-3">Refund Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((refund) => (
                <tr key={refund.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/bookings`} className="text-ink-accent hover:underline">
                      {refund.bookingDisplayId}
                    </Link>
                    <div className="text-xs text-ink-tertiary">{refund.leadReferenceId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-ink-primary">{refund.customer.name}</span>
                      <span className="text-xs text-ink-tertiary">{refund.customer.mobile}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-tertiary">
                    Paid {money(refund.paidAmount)} − Cancel {money(refund.cancellationCharge)} − Gateway {money(refund.gatewayCharge)}
                    {refund.reason ? <div className="mt-0.5">{refund.reason}</div> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink-heading">{money(refund.refundAmount)}</td>
                  <td className="px-4 py-3">
                    <RefundStatusControl
                      refundId={refund.id}
                      status={statusOverrides[refund.id] ?? refund.status}
                      onChanged={(next) => setStatusOverrides((current) => ({ ...current, [refund.id]: next }))}
                      canApprove={canApproveRefunds}
                    />
                  </td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatDate(refund.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <p className="text-xs text-ink-tertiary">
          Showing {items.length} of {total} refund{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
