"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BookingStatusBadge } from "@/components/crm/BookingStatusBadge";
import { PaymentStatusBadge } from "@/components/crm/PaymentStatusBadge";
import { DateRangeFilter } from "@/components/crm/DateRangeFilter";
import { useDateRangeFilter } from "@/components/crm/useDateRangeFilter";
import { ListPagination } from "@/components/crm/ListPagination";
import { usePaginationState } from "@/components/crm/usePagination";
import { FilterSelect, FilterTextInput, ListStateView, SEARCH_DEBOUNCE_MS, type FetchState } from "./MonitoringControls";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS, BOOKING_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from "@/lib/crm/labels";
import { formatDateTime } from "@/lib/admin/monitoring";
import { formatCurrency } from "@/lib/format-currency";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceType, BookingStatus, PaymentStatus } from "../../generated/prisma/enums";

interface AdminBookingRow {
  id: string;
  bookingId: string;
  status: BookingStatus;
  serviceStatusName: string | null;
  createdAt: string;
  serviceType: ServiceType;
  leadId: string;
  leadReference: string;
  country: string | null;
  assignedStaffName: string | null;
  vendorName: string | null;
  customer: { name: string; mobile: string; email: string | null };
  latestPayment: { status: PaymentStatus; total: number } | null;
}

interface AdminBookingsResponse {
  items: AdminBookingRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface FilterOptionsResponse {
  staff: { id: string; name: string; active: boolean }[];
  vendors: { id: string; name: string; active: boolean }[];
  countries: { id: string; name: string; code: string }[];
  serviceStatuses: { id: string; name: string; serviceType: ServiceType; active: boolean }[];
}


/** P24 item 5 — Admin → Bookings: read-only cross-service search; every row opens the existing CRM booking page. */
export function AdminBookingsExplorer() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [countryId, setCountryId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("");
  const [serviceStatusId, setServiceStatusId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear: clearDates } = useDateRangeFilter();
  const { page, pageSize, setPage, paginationHandlers } = usePaginationState();

  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<AdminBookingsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [options, setOptions] = useState<FilterOptionsResponse | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, setPage]);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      try {
        const result = await getJson<FilterOptionsResponse>("/api/admin/bookings/filters");
        if (!cancelled) setOptions(result);
      } catch {
        // Filter dropdowns just stay limited to the static options; the list itself still works.
      }
    }
    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBookings() {
      setState("loading");
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (serviceType) params.set("serviceType", serviceType);
      if (countryId) params.set("countryId", countryId);
      if (staffId) params.set("staffId", staffId);
      if (vendorId) params.set("vendorId", vendorId);
      if (status) params.set("status", status);
      if (serviceStatusId) params.set("serviceStatusId", serviceStatusId);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      try {
        const result = await getJson<AdminBookingsResponse>(`/api/admin/bookings?${params.toString()}`);
        if (cancelled) return;
        setData(result);
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
  }, [search, serviceType, countryId, staffId, vendorId, status, serviceStatusId, paymentStatus, dateFrom, dateTo, page, pageSize, refreshNonce]);

  /** Wraps a filter setter so any filter change goes back to page 1. */
  function onFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  const hasFilters = Boolean(
    searchInput || serviceType || countryId || staffId || vendorId || status || serviceStatusId || paymentStatus || dateFrom || dateTo
  );

  function clearAll() {
    setSearchInput("");
    setSearch("");
    setServiceType("");
    setCountryId("");
    setStaffId("");
    setVendorId("");
    setStatus("");
    setServiceStatusId("");
    setPaymentStatus("");
    clearDates();
    setPage(1);
  }

  const serviceStatusOptions = (options?.serviceStatuses ?? [])
    .filter((serviceStatus) => !serviceType || serviceStatus.serviceType === serviceType)
    .map((serviceStatus) => ({
      value: serviceStatus.id,
      label: `${SERVICE_TYPE_LABELS[serviceStatus.serviceType]} · ${serviceStatus.name}${serviceStatus.active ? "" : " (inactive)"}`,
    }));

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterTextInput
          id="admin-bookings-search"
          label="Search"
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Booking id, lead ref, customer name, mobile, email…"
          withIcon
          className="sm:col-span-2"
        />
        <FilterSelect
          id="admin-bookings-service"
          label="Service"
          value={serviceType}
          onChange={(value) => {
            onFilter(setServiceType)(value);
            setServiceStatusId("");
          }}
          options={SERVICE_TYPE_OPTIONS}
          allLabel="All services"
        />
        <FilterSelect
          id="admin-bookings-country"
          label="Country"
          value={countryId}
          onChange={onFilter(setCountryId)}
          options={(options?.countries ?? []).map((country) => ({ value: country.id, label: `${country.name} (${country.code})` }))}
          allLabel="All countries"
        />
        <FilterSelect
          id="admin-bookings-staff"
          label="Staff (assignee)"
          value={staffId}
          onChange={onFilter(setStaffId)}
          options={[
            { value: "unassigned", label: "Unassigned" },
            ...(options?.staff ?? []).map((member) => ({ value: member.id, label: member.active ? member.name : `${member.name} (inactive)` })),
          ]}
          allLabel="All staff"
        />
        <FilterSelect
          id="admin-bookings-vendor"
          label="Vendor"
          value={vendorId}
          onChange={onFilter(setVendorId)}
          options={(options?.vendors ?? []).map((vendor) => ({ value: vendor.id, label: vendor.active ? vendor.name : `${vendor.name} (inactive)` }))}
          allLabel="All vendors"
        />
        <FilterSelect
          id="admin-bookings-status"
          label="Booking status"
          value={status}
          onChange={onFilter(setStatus)}
          options={BOOKING_STATUS_OPTIONS}
          allLabel="All statuses"
        />
        <FilterSelect
          id="admin-bookings-service-status"
          label="Service status"
          value={serviceStatusId}
          onChange={onFilter(setServiceStatusId)}
          options={serviceStatusOptions}
          allLabel="All service statuses"
        />
        <FilterSelect
          id="admin-bookings-payment"
          label="Latest payment"
          value={paymentStatus}
          onChange={onFilter(setPaymentStatus)}
          options={[...PAYMENT_STATUS_OPTIONS, { value: "NONE", label: "No payment yet" }]}
          allLabel="Any payment status"
        />
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <span className="text-xs font-medium text-ink-tertiary">Created</span>
          <DateRangeFilter
            idPrefix="admin-bookings"
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPreset={(days) => {
              applyPreset(days);
              setPage(1);
            }}
            onCustomFrom={(value) => {
              applyCustomFrom(value);
              setPage(1);
            }}
            onCustomTo={(value) => {
              applyCustomTo(value);
              setPage(1);
            }}
            onClear={() => {
              clearDates();
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => setRefreshNonce((current) => current + 1)} disabled={state === "loading"}>
            <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-4 w-4" aria-hidden="true" />
              Clear all filters
            </Button>
          ) : null}
        </div>
      </div>

      <ListStateView
        state={state}
        isEmpty={items.length === 0}
        errorTitle="Couldn't load bookings"
        errorMessage={errorMessage}
        emptyTitle="No bookings match these filters"
        emptyDescription="Try a different search term or clear some filters."
        onRetry={() => setRefreshNonce((current) => current + 1)}
      >
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th scope="col" className="px-4 py-3">Booking</th>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Service / Country</th>
                <th scope="col" className="px-4 py-3">Staff / Vendor</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Latest payment</th>
                <th scope="col" className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((booking) => (
                <tr key={booking.id} className="border-b border-hairline align-top last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/crm/bookings/${booking.id}`} className="text-ink-accent hover:underline">
                      {booking.bookingId}
                    </Link>
                    <div className="text-xs font-normal text-ink-tertiary">Lead {booking.leadReference}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-primary">{booking.customer.name}</div>
                    <div className="text-xs text-ink-tertiary">{booking.customer.mobile}</div>
                    {booking.customer.email ? <div className="text-xs text-ink-tertiary">{booking.customer.email}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    <div>{SERVICE_TYPE_LABELS[booking.serviceType]}</div>
                    <div className="text-xs text-ink-tertiary">{booking.country ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    <div>{booking.assignedStaffName ?? <span className="text-ink-tertiary">Unassigned</span>}</div>
                    <div className="text-xs text-ink-tertiary">{booking.vendorName ?? "No vendor selected"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <BookingStatusBadge status={booking.status} />
                    {booking.serviceStatusName ? <div className="mt-1 text-xs text-ink-tertiary">{booking.serviceStatusName}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    {booking.latestPayment ? (
                      <>
                        <PaymentStatusBadge status={booking.latestPayment.status} />
                        <div className="mt-1 text-xs text-ink-tertiary">{formatCurrency(booking.latestPayment.total)}</div>
                      </>
                    ) : (
                      <span className="text-xs text-ink-tertiary">No payment yet</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-tertiary">{formatDateTime(booking.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListStateView>

      {state === "success" && data ? (
        <ListPagination
          noun="booking"
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          itemCount={items.length}
          {...paginationHandlers}
        />
      ) : null}
    </div>
  );
}
