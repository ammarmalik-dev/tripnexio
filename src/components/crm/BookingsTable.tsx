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
import { BookingStatusBadge } from "./BookingStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { DashboardFilterChip } from "./DashboardFilterChip";
import { DateRangeFilter } from "./DateRangeFilter";
import { useDateRangeFilter } from "./useDateRangeFilter";
import { ExportCsvButton } from "./ExportCsvButton";
import { SERVICE_TYPE_LABELS, BOOKING_STATUS_OPTIONS, BOOKING_STATUS_LABELS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceType, BookingStatus, PaymentStatus } from "../../generated/prisma/enums";

interface BookingListItem {
  id: string;
  bookingId: string;
  status: BookingStatus;
  createdAt: string;
  serviceType: ServiceType;
  leadReferenceId: string;
  customer: { name: string; mobile: string };
  latestPayment: { id: string; status: PaymentStatus } | null;
}

interface BookingListResponse {
  items: BookingListItem[];
  total: number;
}

type SortOption = "createdAt_desc" | "createdAt_asc";
type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function BookingsTable() {
  // Step 53 — read once on mount, so a Command Centre KPI card's link
  // (e.g. /crm/bookings?status=PENDING,CONFIRMED,PROCESSING for "Active
  // Bookings") lands pre-filtered. A comma-separated combo has no matching
  // option in the dropdown below, so it renders blank there until staff
  // pick a single status — the combo itself still drives the fetch though.
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear: clearDates } = useDateRangeFilter(
    searchParams.get("dateFrom") ?? "",
    searchParams.get("dateTo") ?? ""
  );
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  function buildFilterParams() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (search) params.set("search", search);
    params.set("sort", sort);
    return params;
  }

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadBookings() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (search) params.set("search", search);
        params.set("sort", sort);

        const result = await getJson<BookingListResponse>(`/api/bookings?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load bookings. Please try again.");
        setState("error");
      }
    }

    void loadBookings();
    return () => {
      cancelled = true;
    };
  }, [status, dateFrom, dateTo, search, sort, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="booking-search" className="sr-only">
            Search by booking id, customer name, or mobile
          </label>
          <input
            id="booking-search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by booking id, customer name, or mobile…"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>

        <label htmlFor="filter-booking-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-booking-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[160px]")}
        >
          <option value="">All statuses</option>
          {BOOKING_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="sort-bookings" className="sr-only">
          Sort by created date
        </label>
        <select
          id="sort-bookings"
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

        <ExportCsvButton href={`/api/bookings/export?${buildFilterParams().toString()}`} />
      </div>

      <DateRangeFilter
        idPrefix="booking"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPreset={applyPreset}
        onCustomFrom={applyCustomFrom}
        onCustomTo={applyCustomTo}
        onClear={clearDates}
      />

      <DashboardFilterChip
        label={status.includes(",") ? status.split(",").map((s) => BOOKING_STATUS_LABELS[s as BookingStatus] ?? s).join(", ") : undefined}
        clearHref="/crm/bookings"
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
          title="Couldn't load bookings"
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
          title="No bookings match these filters"
          description="Try a different search term or clear the filters."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((booking) => (
                <tr key={booking.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/bookings/${booking.id}`} className="text-ink-accent hover:underline">
                      {booking.bookingId}
                    </Link>
                    <div className="text-xs text-ink-tertiary">{booking.leadReferenceId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-ink-primary">{booking.customer.name}</span>
                      <span className="text-xs text-ink-tertiary">{booking.customer.mobile}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{SERVICE_TYPE_LABELS[booking.serviceType]}</td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge status={booking.status} />
                  </td>
                  <td className="px-4 py-3">
                    {booking.latestPayment ? (
                      <PaymentStatusBadge status={booking.latestPayment.status} />
                    ) : (
                      <span className="text-xs text-ink-tertiary">No payment yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatDate(booking.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <p className="text-xs text-ink-tertiary">
          Showing {items.length} of {total} booking{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
