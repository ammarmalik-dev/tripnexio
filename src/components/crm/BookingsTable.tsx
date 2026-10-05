"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, RotateCw, Search } from "lucide-react";
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
import { UrgentBadge } from "./UrgentBadge";
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_OPTIONS,
  BOOKING_STATUS_OPTIONS,
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
} from "@/lib/crm/labels";
import { ListPagination } from "./ListPagination";
import { usePaginationState } from "./usePagination";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceType, BookingStatus, PaymentStatus } from "../../generated/prisma/enums";

interface BookingListItem {
  id: string;
  bookingId: string;
  status: BookingStatus;
  createdAt: string;
  serviceType: ServiceType;
  subService: string | null;
  urgent: boolean;
  leadReferenceId: string;
  customer: { name: string; mobile: string };
  paxCount: number | null;
  countryName: string | null;
  travelDate: string | null;
  customerStatus: string | null;
  internalStatus: string | null;
  poc: { name: string; active: boolean } | null;
  vendorName: string | null;
  source: string | null;
  appliedAt: string | null;
  latestPayment: { id: string; status: PaymentStatus } | null;
}

interface BookingListResponse {
  items: BookingListItem[];
  total: number;
}

interface FilterOptions {
  staff: { id: string; name: string; active: boolean }[];
  vendors: { id: string; name: string; active: boolean }[];
  countries: { id: string; name: string }[];
  serviceStatuses: { id: string; name: string; serviceType: ServiceType; active: boolean }[];
}

type SortOption = "createdAt_desc" | "createdAt_asc";
type FetchState = "loading" | "success" | "error";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function formatDay(day: string | null): string {
  return day
    ? new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "—";
}

const selectClass = cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]");

/**
 * Client corrections 2026-10-05 — the full operational Bookings table, shared
 * by CRM (/crm/bookings) and Admin (/admin/bookings, `detailBasePath`
 * "/admin/bookings" so a booking opens inside Admin). No page search box:
 * the global 360 search covers that; a ?search= link still pre-filters.
 * Unpaid bookings never appear (see src/lib/bookings/list-where.ts).
 */
export function BookingsTable({ detailBasePath = "/crm/bookings" }: { detailBasePath?: string } = {}) {
  const searchParams = useSearchParams();
  const param = (key: string) => searchParams.get(key) ?? "";
  const [status, setStatus] = useState(() => param("status"));
  const [serviceType, setServiceType] = useState(() => param("serviceType"));
  const [serviceStatusId, setServiceStatusId] = useState(() => param("serviceStatusId"));
  const [paymentStatus, setPaymentStatus] = useState(() => param("paymentStatus"));
  const [assignedStaffId, setAssignedStaffId] = useState(() => param("assignedStaffId"));
  const [countryId, setCountryId] = useState(() => param("countryId"));
  const [vendorId, setVendorId] = useState(() => param("vendorId"));
  const [travelFrom, setTravelFrom] = useState(() => param("travelFrom"));
  const [travelTo, setTravelTo] = useState(() => param("travelTo"));
  const [search] = useState(() => param("search"));
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear: clearDates } = useDateRangeFilter(param("dateFrom"), param("dateTo"));
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [options, setOptions] = useState<FilterOptions>({ staff: [], vendors: [], countries: [], serviceStatuses: [] });
  const { page, pageSize, resetPage, paginationHandlers } = usePaginationState();

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const result = await getJson<FilterOptions>("/api/admin/bookings/filters");
        if (!cancelled) setOptions(result);
      } catch {
        // Filters just stay empty — the list itself still loads.
      }
    }
    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  function buildFilterParams() {
    const params = new URLSearchParams();
    const entries: [string, string][] = [
      ["status", status],
      ["serviceType", serviceType],
      ["serviceStatusId", serviceStatusId],
      ["paymentStatus", paymentStatus],
      ["assignedStaffId", assignedStaffId],
      ["countryId", countryId],
      ["vendorId", vendorId],
      ["travelFrom", travelFrom],
      ["travelTo", travelTo],
      ["dateFrom", dateFrom],
      ["dateTo", dateTo],
      ["search", search],
    ];
    for (const [key, value] of entries) if (value) params.set(key, value);
    params.set("sort", sort);
    return params;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadBookings() {
      setState("loading");
      try {
        const params = buildFilterParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
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
    // buildFilterParams reads exactly the state listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, serviceType, serviceStatusId, paymentStatus, assignedStaffId, countryId, vendorId, travelFrom, travelTo, dateFrom, dateTo, search, sort, page, pageSize, refreshNonce]);

  const internalStatusOptions = serviceType ? options.serviceStatuses.filter((option) => option.serviceType === serviceType) : [];

  function filterSelect(id: string, label: string, value: string, onChange: (next: string) => void, allLabel: string, choices: { value: string; label: string }[]) {
    return (
      <>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            resetPage();
          }}
          className={selectClass}
        >
          <option value="">{allLabel}</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {filterSelect("filter-booking-service", "Filter by service", serviceType, (next) => {
          setServiceType(next);
          setServiceStatusId("");
        }, "All services", SERVICE_TYPE_OPTIONS)}
        {filterSelect(
          "filter-booking-status",
          "Filter by booking status",
          status,
          setStatus,
          "All booking statuses",
          BOOKING_STATUS_OPTIONS.filter((option) => option.value !== "PENDING")
        )}
        {serviceType
          ? filterSelect(
              "filter-booking-internal",
              "Filter by internal status",
              serviceStatusId,
              setServiceStatusId,
              "All internal statuses",
              internalStatusOptions.map((option) => ({ value: option.id, label: option.name }))
            )
          : null}
        {filterSelect("filter-booking-payment", "Filter by payment status", paymentStatus, setPaymentStatus, "All payments", PAYMENT_STATUS_OPTIONS)}
        {filterSelect("filter-booking-poc", "Filter by POC", assignedStaffId, setAssignedStaffId, "All POCs", [
          { value: "unassigned", label: "Unassigned" },
          ...options.staff.map((member) => ({ value: member.id, label: member.active ? member.name : `${member.name} (inactive)` })),
        ])}
        {filterSelect(
          "filter-booking-country",
          "Filter by country",
          countryId,
          setCountryId,
          "All countries",
          options.countries.map((country) => ({ value: country.id, label: country.name }))
        )}
        {filterSelect(
          "filter-booking-vendor",
          "Filter by vendor",
          vendorId,
          setVendorId,
          "All vendors",
          options.vendors.map((vendor) => ({ value: vendor.id, label: vendor.active ? vendor.name : `${vendor.name} (inactive)` }))
        )}

        <div className="flex items-center gap-1.5">
          <label htmlFor="filter-booking-travel-from" className="text-xs text-ink-tertiary">
            Travel
          </label>
          <input
            id="filter-booking-travel-from"
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

        <label htmlFor="sort-bookings" className="sr-only">
          Sort by booking date
        </label>
        <select
          id="sort-bookings"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as SortOption);
            resetPage();
          }}
          className={selectClass}
        >
          <option value="createdAt_desc">Newest first</option>
          <option value="createdAt_asc">Oldest first</option>
        </select>

        <Button type="button" variant="ghost" size="md" onClick={() => setRefreshNonce((current) => current + 1)} disabled={state === "loading"}>
          <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>

        <ExportCsvButton href={`/api/bookings/export?${buildFilterParams().toString()}`} />
      </div>

      <DateRangeFilter
        idPrefix="booking"
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

      <DashboardFilterChip
        label={status.includes(",") ? status.split(",").map((s) => BOOKING_STATUS_LABELS[s as BookingStatus] ?? s).join(", ") : undefined}
        clearHref={detailBasePath}
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
          description="Try different filters, or clear them. Bookings appear here once payment succeeds."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[1600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                <th className="px-3 py-3">Booking ID</th>
                <th className="px-3 py-3">PAX</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Mobile</th>
                <th className="px-3 py-3">Country</th>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3">Sub-service</th>
                <th className="px-3 py-3">Booking Date</th>
                <th className="px-3 py-3">Travel Date</th>
                <th className="px-3 py-3">Customer Status</th>
                <th className="px-3 py-3">Internal Status</th>
                <th className="px-3 py-3">Payment</th>
                <th className="px-3 py-3">POC</th>
                <th className="px-3 py-3">Vendor</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Apply Date</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((booking) => {
                const href = `${detailBasePath}/${booking.id}`;
                return (
                  <tr key={booking.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                    <td className="px-3 py-3 font-medium whitespace-nowrap">
                      <Link href={href} className="text-ink-accent hover:underline">
                        {booking.bookingId}
                      </Link>
                      {booking.urgent ? (
                        <div className="mt-1">
                          <UrgentBadge serviceType={booking.serviceType} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-ink-secondary tabular-nums">{booking.paxCount ?? "—"}</td>
                    <td className="px-3 py-3 font-medium text-ink-primary">{booking.customer.name}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">{booking.customer.mobile}</td>
                    <td className="px-3 py-3 text-ink-secondary">{booking.countryName ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-secondary">{SERVICE_TYPE_LABELS[booking.serviceType]}</td>
                    <td className="px-3 py-3 text-ink-secondary">{booking.subService ?? "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">{formatDate(booking.createdAt)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">{formatDay(booking.travelDate)}</td>
                    <td className="px-3 py-3">
                      {booking.customerStatus ? (
                        <span className="text-ink-secondary">{booking.customerStatus}</span>
                      ) : (
                        <BookingStatusBadge status={booking.status} />
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-secondary">{booking.internalStatus ?? "—"}</td>
                    <td className="px-3 py-3">
                      {booking.latestPayment ? <PaymentStatusBadge status={booking.latestPayment.status} /> : <span className="text-xs text-ink-tertiary">—</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-secondary">
                      {booking.poc ? (booking.poc.active ? booking.poc.name : `Unassigned (was ${booking.poc.name})`) : "Unassigned"}
                    </td>
                    <td className="px-3 py-3 text-ink-secondary">{booking.vendorName ?? "—"}</td>
                    <td className="px-3 py-3 text-ink-secondary">{booking.source ?? "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">{formatDate(booking.appliedAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={href} className="inline-flex items-center gap-1 font-medium text-ink-accent hover:underline">
                        Open
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <ListPagination noun="booking" page={page} pageSize={pageSize} total={total} itemCount={items.length} {...paginationHandlers} />
      ) : null}
    </div>
  );
}
