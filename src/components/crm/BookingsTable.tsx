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
import { StatusPill } from "./StatusPill";
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
  customer: { name: string; mobile: string; email: string | null };
  paxCount: number | null;
  countryName: string | null;
  countryCode: string | null;
  countryFlag: string | null;
  serviceDetails: string | null;
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
  serviceStatuses: { id: string; name: string; customerLabel: string; serviceType: ServiceType; active: boolean }[];
}

type SortOption = "createdAt_desc" | "createdAt_asc";
type FetchState = "loading" | "success" | "error";

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
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
  const [customerStatus, setCustomerStatus] = useState(() => param("customerStatus"));
  const [paymentStatus, setPaymentStatus] = useState(() => param("paymentStatus"));
  const [assignedStaffId, setAssignedStaffId] = useState(() => param("assignedStaffId"));
  const [countryId, setCountryId] = useState(() => param("countryId"));
  const [vendorId, setVendorId] = useState(() => param("vendorId"));
  const [travelFrom, setTravelFrom] = useState(() => param("travelFrom"));
  const [travelTo, setTravelTo] = useState(() => param("travelTo"));
  // Client testing 2026-10-09 (E13) — search by Booking ID, name, mobile, email or passport.
  const [search, setSearch] = useState(() => param("search"));
  const [searchDraft, setSearchDraft] = useState(() => param("search"));
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
      ["customerStatus", customerStatus],
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
  }, [status, serviceType, serviceStatusId, customerStatus, paymentStatus, assignedStaffId, countryId, vendorId, travelFrom, travelTo, dateFrom, dateTo, search, sort, page, pageSize, refreshNonce]);

  // Client testing 2026-10-09 (E13) — every status is in the filters, not only after picking a service.
  const internalStatusOptions = serviceType ? options.serviceStatuses.filter((option) => option.serviceType === serviceType) : options.serviceStatuses;
  const customerStatusOptions = [...new Set(internalStatusOptions.map((option) => option.customerLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b));

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
      <form
        role="search"
        className="flex w-full max-w-xl items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchDraft.trim());
          resetPage();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search bookings"
            placeholder="Search booking ID, name, mobile, email, passport…"
            value={searchDraft}
            onChange={(event) => {
              setSearchDraft(event.target.value);
              if (event.target.value === "") {
                setSearch("");
                resetPage();
              }
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-10")}
          />
        </div>
        <Button type="submit" size="md">
          Search
        </Button>
      </form>

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
        {filterSelect(
          "filter-booking-customer-status",
          "Filter by customer status",
          customerStatus,
          (next) => {
            setCustomerStatus(next);
            setServiceStatusId("");
          },
          "Customer status",
          customerStatusOptions.map((label) => ({ value: label, label }))
        )}
        {filterSelect(
          "filter-booking-internal",
          "Filter by internal status",
          serviceStatusId,
          (next) => {
            setServiceStatusId(next);
            setCustomerStatus("");
          },
          "Internal status",
          internalStatusOptions.map((option) => ({
            value: option.id,
            label: serviceType ? option.name : `${SERVICE_TYPE_LABELS[option.serviceType]} — ${option.name}`,
          }))
        )}
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
          <table className="w-full min-w-[1500px] border-collapse text-sm">
            <thead>
              {/* Client testing 2026-10-09 (E13) — the client's table: Title Case headers, PAX under the Booking ID. */}
              <tr className="border-b border-hairline text-left text-xs font-semibold text-ink-secondary">
                <th className="px-3 py-3">Booking ID</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Mobile</th>
                <th className="px-3 py-3">Country</th>
                <th className="px-3 py-3">
                  Service
                  <span className="block font-normal text-ink-tertiary">Sub-Service</span>
                </th>
                <th className="px-3 py-3">Service Details</th>
                <th className="px-3 py-3">Travel Date</th>
                <th className="px-3 py-3">Booking Date</th>
                <th className="px-3 py-3">Cust. Status</th>
                <th className="px-3 py-3">Internal Status</th>
                <th className="px-3 py-3">Payment</th>
                <th className="px-3 py-3">POC</th>
                <th className="px-3 py-3">Vendor</th>
                <th className="px-3 py-3">Applied to Embassy</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((booking) => {
                const href = `${detailBasePath}/${booking.id}`;
                return (
                  <tr key={booking.id} className="border-b border-hairline align-top last:border-b-0 hover:bg-ink-primary/[0.02]">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link href={href} className="font-semibold text-ink-accent hover:underline">
                        {booking.bookingId}
                      </Link>
                      <span className="block text-xs text-ink-tertiary">{booking.paxCount ?? "—"} PAX</span>
                      {booking.urgent ? (
                        <div className="mt-1">
                          <UrgentBadge serviceType={booking.serviceType} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold text-ink-heading">{booking.customer.name}</span>
                      {booking.customer.email ? <span className="block text-xs text-ink-tertiary">{booking.customer.email}</span> : null}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">{booking.customer.mobile}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">
                      {booking.countryName ? (
                        <span className="inline-flex items-center gap-1.5">
                          {booking.countryFlag ? (
                            <span className="text-base leading-none" aria-hidden="true">
                              {booking.countryFlag}
                            </span>
                          ) : null}
                          {booking.countryName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold text-ink-heading">{SERVICE_TYPE_LABELS[booking.serviceType]}</span>
                      {booking.subService ? <span className="block text-xs text-ink-tertiary">{booking.subService}</span> : null}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 text-ink-secondary">{booking.serviceDetails ?? "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">{formatDay(booking.travelDate)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">
                      {formatDate(booking.createdAt)}
                      <span className="block text-xs text-ink-tertiary">{formatTime(booking.createdAt)}</span>
                    </td>
                    <td className="px-3 py-3">
                      {booking.customerStatus ? <StatusPill label={booking.customerStatus} /> : <BookingStatusBadge status={booking.status} />}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill label={booking.internalStatus} />
                    </td>
                    <td className="px-3 py-3">
                      {booking.latestPayment ? <PaymentStatusBadge status={booking.latestPayment.status} /> : <span className="text-xs text-ink-tertiary">—</span>}
                    </td>
                    <td className="px-3 py-3 text-ink-secondary">
                      {booking.poc ? (booking.poc.active ? booking.poc.name : `Unassigned (was ${booking.poc.name})`) : "Unassigned"}
                    </td>
                    <td className="px-3 py-3 text-ink-secondary">{booking.vendorName ?? "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-secondary">{booking.appliedAt ? formatDate(booking.appliedAt) : "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 font-medium text-ink-heading transition-colors hover:border-glass-border hover:bg-ink-primary/[0.03]"
                      >
                        View
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
