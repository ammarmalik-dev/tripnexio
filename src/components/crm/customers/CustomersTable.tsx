"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import type { CustomerListItem, CustomerListResponse } from "@/lib/customers/types";
import { formatCrmDate } from "./format";
import { ListPagination } from "../ListPagination";
import { usePaginationState } from "../usePagination";

type FetchState = "loading" | "success" | "error";

/** CRM.md §23 — Customers list: server-side search + pagination. */
export function CustomersTable() {
  // Client doc 2026-10-20 (L4) — a Search box (name, email, mobile) instead of Refresh.
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const { page, pageSize, setPage, paginationHandlers } = usePaginationState();
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Debounce typing; a new search always starts back on page 1.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, setPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        const result = await getJson<CustomerListResponse>(`/api/customers?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load customers. Please try again.");
        setState("error");
      }
    }

    void loadCustomers();
    return () => {
      cancelled = true;
    };
  }, [search, page, pageSize, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <input
          id="customer-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email or mobile"
          className={cn(fieldControlClass, fieldBorderClass(false), "h-9 pl-9 text-sm")}
        />
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4" aria-busy="true" aria-label="Loading customers">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load customers"
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
          icon={search ? <Search className="h-5 w-5" aria-hidden="true" /> : <Users className="h-5 w-5" aria-hidden="true" />}
          title={search ? "No customers match this search" : "No customers yet"}
          description={
            search
              ? "Try a different name, mobile, email, passport number, or reference."
              : "Customers appear here once they submit their first request."
          }
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Bookings</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr key={customer.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/customers/${customer.id}`} className="text-ink-accent hover:underline">
                      {customer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{customer.mobile}</td>
                  <td className="px-4 py-3 text-ink-secondary">{customer.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">{customer.leadCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">{customer.bookingCount}</td>
                  <td className="px-4 py-3 text-ink-secondary">{customer.source ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatCrmDate(customer.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/crm/customers/${customer.id}`} className="font-medium text-ink-accent hover:underline">
                      Open 360
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
          noun="customer"
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
