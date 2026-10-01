"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Download, Eye, FileArchive, FileText, Receipt, RotateCw, Search, X } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { DateRangeFilter } from "./DateRangeFilter";
import { useDateRangeFilter } from "./useDateRangeFilter";
import { ListPagination } from "./ListPagination";
import { usePaginationState } from "./usePagination";
import { getJson, ApiError } from "@/lib/api/client";
import type { ApiErrorBody } from "@/lib/api/respond";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { MAX_EXPORT_ROWS } from "@/lib/csv/export-limits";
import { formatCurrency } from "@/lib/format-currency";
import {
  MAX_INVOICE_ZIP,
  financialYearOptions,
  type InvoiceRefundState,
  type InvoiceSort,
} from "@/lib/invoices/invoice-filters";
import type { InvoiceListItem, InvoiceSummary } from "@/lib/invoices/invoice-register";
import { cn } from "@/lib/cn";

/** JSON-serialized shape of GET /api/invoices. */
interface InvoiceListResponse {
  items: InvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: InvoiceSummary;
}

type FetchState = "loading" | "success" | "error";

const METHOD_LABELS: Record<InvoiceListItem["method"], string> = { GATEWAY: "Gateway", BANK_TRANSFER: "Bank transfer" };
const PURPOSE_LABELS: Record<InvoiceListItem["purpose"], string> = { PRIMARY: "Primary", EXTRA: "Extra" };

const REFUND_STATE_LABELS: Record<InvoiceRefundState, string> = {
  none: "Not refunded",
  partial: "Partially refunded",
  full: "Fully refunded",
};

const REFUND_STATE_STYLES: Record<InvoiceRefundState, string> = {
  none: "bg-ink-primary/[0.06] text-ink-secondary",
  partial: "bg-warning/10 text-warning",
  full: "bg-error/10 text-error",
};

const SORT_LABELS: Record<InvoiceSort, string> = {
  date_desc: "Newest first",
  date_asc: "Oldest first",
  total_desc: "Highest total",
  total_asc: "Lowest total",
};

const selectClass = cn(fieldControlClass, fieldBorderClass(false), "w-full sm:w-auto sm:min-w-[150px]");

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  const match = header ? /filename="?([^";]+)"?/i.exec(header) : null;
  return match?.[1] ?? fallback;
}

/**
 * Fetches a file and saves it via an object URL, so a failure (409 over the
 * ZIP cap, 403, 500…) surfaces as a toast instead of a broken download page.
 */
async function downloadFile(url: string, fallbackName: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(body?.error?.message ?? "The download failed. Please try again.", undefined, response.status);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filenameFromDisposition(response.headers.get("Content-Disposition"), fallbackName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return response;
}

function RefundBadge({ state }: { state: InvoiceRefundState }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", REFUND_STATE_STYLES[state])}>
      {REFUND_STATE_LABELS[state]}
    </span>
  );
}

function StatCard({ label, value, hint, loading, emphasis }: { label: string; value: string; hint?: string; loading: boolean; emphasis?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border border-hairline bg-surface-1 p-4",
        emphasis && "border-accent/25 bg-accent/[0.04]"
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">{label}</span>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <span className={cn("truncate text-xl font-semibold tabular-nums text-ink-heading", emphasis && "text-ink-accent")} title={value}>
          {value}
        </span>
      )}
      {hint ? <span className="text-[11px] text-ink-muted">{hint}</span> : null}
    </div>
  );
}

function FilterSelect({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        {children}
      </select>
    </>
  );
}

/**
 * Invoice History — the tax-invoice register (SUCCESS payments) for staff
 * (CRM) and admin. Filters drive GET /api/invoices; the same filter set
 * feeds the CSV register (/api/invoices/export) and the bulk PDF ZIP
 * (/api/invoices/download, capped at MAX_INVOICE_ZIP).
 */
export function InvoiceHistory() {
  const { page, pageSize, setPage, resetPage, paginationHandlers } = usePaginationState();
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear: clearDates } = useDateRangeFilter();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [method, setMethod] = useState("");
  const [purpose, setPurpose] = useState("");
  const [refundState, setRefundState] = useState("");
  const [financialYear, setFinancialYear] = useState("");
  const [sort, setSort] = useState<InvoiceSort>("date_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fyOptions = useMemo(() => financialYearOptions(new Date(), -new Date().getTimezoneOffset()), []);

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (serviceType) params.set("serviceType", serviceType);
    if (method) params.set("method", method);
    if (purpose) params.set("purpose", purpose);
    if (refundState) params.set("refundState", refundState);
    if (financialYear) params.set("financialYear", financialYear);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("sort", sort);
    return params.toString();
  }, [search, serviceType, method, purpose, refundState, financialYear, dateFrom, dateTo, sort]);

  const hasFilters = Boolean(searchInput || serviceType || method || purpose || refundState || financialYear || dateFrom || dateTo);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoices() {
      setState("loading");
      try {
        const result = await getJson<InvoiceListResponse>(`/api/invoices?${filterQuery}&page=${page}&pageSize=${pageSize}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load invoices. Please try again.");
        setState("error");
      }
    }

    void loadInvoices();
    return () => {
      cancelled = true;
    };
  }, [filterQuery, page, pageSize, refreshNonce]);

  /** Wraps a filter setter so every filter change goes back to page 1. */
  function onFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      resetPage();
    };
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setServiceType("");
    setMethod("");
    setPurpose("");
    setRefundState("");
    setFinancialYear("");
    clearDates();
    resetPage();
  }

  const summary = data?.summary;
  const matchCount = summary?.count ?? 0;
  const items = data?.items ?? [];
  const loading = state === "loading";
  const overZipCap = matchCount > MAX_INVOICE_ZIP;

  async function handleExport() {
    setExporting(true);
    try {
      const response = await downloadFile(`/api/invoices/export?${filterQuery}`, "invoices.csv");
      const rows = response.headers.get("X-Export-Row-Count") ?? "0";
      if (response.headers.get("X-Export-Truncated") === "true") {
        toast.warning(`Exported the first ${MAX_EXPORT_ROWS.toLocaleString("en-IN")} invoices. Narrow the filters to export the rest.`);
      } else {
        toast.success(`Exported ${rows} invoice${rows === "1" ? "" : "s"} to CSV.`);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't export invoices. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleZip() {
    if (overZipCap) {
      toast.error(`A bulk download is limited to ${MAX_INVOICE_ZIP} invoices. Narrow the filters and try again.`);
      return;
    }
    setZipping(true);
    try {
      const response = await downloadFile(`/api/invoices/download?${filterQuery}`, "invoices.zip");
      const count = response.headers.get("X-Export-Row-Count") ?? String(matchCount);
      toast.success(`Downloaded ${count} invoice PDF${count === "1" ? "" : "s"}.`);
      // Missing invoice numbers may have just been assigned — show them.
      if (items.some((item) => item.invoiceNumber === null)) setRefreshNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't download the invoices. Please try again.");
    } finally {
      setZipping(false);
    }
  }

  async function handleDownload(item: InvoiceListItem) {
    setDownloadingId(item.paymentId);
    try {
      await downloadFile(`/api/payments/${item.paymentId}/invoice`, `invoice-${item.bookingRef}.pdf`);
      toast.success(`Invoice ${item.invoiceNumber ?? item.bookingRef} downloaded.`);
      if (item.invoiceNumber === null) setRefreshNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't download this invoice. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  const money = (value: number) => formatCurrency(value);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Invoice summary for the current filters" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Invoices" value={matchCount.toLocaleString("en-IN")} loading={loading && !summary} />
        <StatCard label="Total invoiced" value={money(summary?.totalInvoiced ?? 0)} hint="Incl. GST & gateway fee" loading={loading && !summary} />
        <StatCard label="GST" value={money(summary?.totalGst ?? 0)} loading={loading && !summary} />
        <StatCard label="Refunded" value={money(summary?.totalRefunded ?? 0)} hint="Completed refunds" loading={loading && !summary} />
        <StatCard label="Net" value={money(summary?.net ?? 0)} hint="Invoiced − refunded" loading={loading && !summary} emphasis />
      </section>

      <section aria-label="Invoice filters" className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
            <label htmlFor="invoice-search" className="sr-only">
              Search by invoice number, booking id, lead reference, customer name, mobile or email
            </label>
            <input
              id="invoice-search"
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                resetPage();
              }}
              placeholder="Invoice no., booking, reference, customer…"
              className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
            />
          </div>

          <FilterSelect id="invoice-service" label="Filter by service" value={serviceType} onChange={onFilter(setServiceType)}>
            <option value="">All services</option>
            {SERVICE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect id="invoice-fy" label="Filter by financial year" value={financialYear} onChange={onFilter(setFinancialYear)}>
            <option value="">All financial years</option>
            {fyOptions.map((fy) => (
              <option key={fy} value={fy}>
                FY {fy}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect id="invoice-sort" label="Sort invoices" value={sort} onChange={onFilter((value: string) => setSort(value as InvoiceSort))}>
            {(Object.keys(SORT_LABELS) as InvoiceSort[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </FilterSelect>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <FilterSelect id="invoice-method" label="Filter by payment method" value={method} onChange={onFilter(setMethod)}>
            <option value="">All methods</option>
            <option value="GATEWAY">Payment gateway</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </FilterSelect>

          <FilterSelect id="invoice-purpose" label="Filter by payment purpose" value={purpose} onChange={onFilter(setPurpose)}>
            <option value="">All purposes</option>
            <option value="PRIMARY">Primary payment</option>
            <option value="EXTRA">Extra payment</option>
          </FilterSelect>

          <FilterSelect id="invoice-refund" label="Filter by refund status" value={refundState} onChange={onFilter(setRefundState)}>
            <option value="">Any refund status</option>
            {(Object.keys(REFUND_STATE_LABELS) as InvoiceRefundState[]).map((key) => (
              <option key={key} value={key}>
                {REFUND_STATE_LABELS[key]}
              </option>
            ))}
          </FilterSelect>

          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-auto">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </Button>
          ) : null}
        </div>

        <DateRangeFilter
          idPrefix="invoice"
          dateFrom={dateFrom}
          dateTo={dateTo}
          onPreset={onFilter(applyPreset)}
          onCustomFrom={onFilter(applyCustomFrom)}
          onCustomTo={onFilter(applyCustomTo)}
          onClear={() => {
            clearDates();
            resetPage();
          }}
        />
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-tertiary" aria-live="polite">
          {loading && !data ? "Loading invoices…" : `${matchCount.toLocaleString("en-IN")} invoice${matchCount === 1 ? "" : "s"} match the current filters`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setRefreshNonce((current) => current + 1)} disabled={loading}>
            <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleExport()}
            isLoading={exporting}
            disabled={matchCount === 0 || exporting}
            title={`Exports up to ${MAX_EXPORT_ROWS.toLocaleString("en-IN")} invoices matching the current filters`}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV ({matchCount.toLocaleString("en-IN")})
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleZip()}
            isLoading={zipping}
            disabled={matchCount === 0 || overZipCap || zipping}
            title={overZipCap ? `Narrow the filters to ${MAX_INVOICE_ZIP} or fewer invoices` : "Download every matching invoice PDF as one ZIP"}
          >
            <FileArchive className="h-4 w-4" aria-hidden="true" />
            Download PDFs (ZIP) ({matchCount.toLocaleString("en-IN")})
          </Button>
        </div>
      </div>
      {overZipCap ? (
        <p className="-mt-3 text-xs text-ink-tertiary sm:text-right">
          Bulk PDF download is limited to {MAX_INVOICE_ZIP} invoices — narrow the filters (e.g. the date range) to enable it.
        </p>
      ) : null}

      {loading && !data ? (
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load invoices"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setRefreshNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state === "success" && items.length === 0 ? (
        (data?.total ?? 0) > 0 ? (
          <EmptyState
            title="This page is empty"
            description="The list changed since this page was opened."
            action={
              <Button type="button" variant="ghost" size="sm" onClick={() => setPage(1)}>
                Go to the first page
              </Button>
            }
          />
        ) : hasFilters ? (
          <EmptyState
            icon={<Search className="h-5 w-5" aria-hidden="true" />}
            title="No invoices match these filters"
            description="Try a different search term or clear the filters."
            action={
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
            title="No invoices yet"
            description="An invoice is issued automatically for every successful payment. They will appear here."
          />
        )
      ) : null}

      {data && items.length > 0 && state !== "error" ? (
        <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <caption className="sr-only">Invoices matching the current filters</caption>
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                  <th scope="col" className="px-4 py-3">Invoice no.</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Customer</th>
                  <th scope="col" className="px-4 py-3">Booking</th>
                  <th scope="col" className="px-4 py-3">Service</th>
                  <th scope="col" className="px-4 py-3">Method</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                  <th scope="col" className="px-4 py-3">Refund</th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.paymentId} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                    <td className="px-4 py-3">
                      {item.invoiceNumber ? (
                        <span className="font-medium tabular-nums text-ink-primary">{item.invoiceNumber}</span>
                      ) : (
                        <span className="text-ink-muted" title="The number is assigned when the invoice is first downloaded">
                          Not yet numbered
                        </span>
                      )}
                      {item.purpose === "EXTRA" ? <div className="text-xs text-ink-tertiary">{PURPOSE_LABELS.EXTRA} payment</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">{formatDate(item.issuedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-ink-primary">{item.customer.name}</span>
                        <span className="text-xs text-ink-tertiary">{item.customer.mobile}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/crm/bookings/${item.bookingId}`} className="font-medium text-ink-accent hover:underline">
                        {item.bookingRef}
                      </Link>
                      <div className="text-xs text-ink-tertiary">{item.leadReference}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{SERVICE_TYPE_LABELS[item.serviceType]}</td>
                    <td className="px-4 py-3 text-ink-secondary">{METHOD_LABELS[item.method]}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span className="font-medium tabular-nums text-ink-primary">{money(item.total)}</span>
                      {item.gstAmount > 0 ? <div className="text-xs tabular-nums text-ink-tertiary">GST {money(item.gstAmount)}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <RefundBadge state={item.refundState} />
                      {item.refundState !== "none" ? (
                        <div className="mt-1 text-xs tabular-nums text-ink-tertiary">{money(item.refundedAmount)}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/payments/${item.paymentId}/invoice?inline=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border hover:bg-accent/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          aria-label={`View invoice ${item.invoiceNumber ?? item.bookingRef} (opens in a new tab)`}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDownload(item)}
                          disabled={downloadingId === item.paymentId}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-medium text-ink-primary transition-colors duration-200 hover:border-glass-border hover:bg-accent/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-50"
                          aria-label={`Download invoice ${item.invoiceNumber ?? item.bookingRef}`}
                        >
                          {downloadingId === item.paymentId ? (
                            <RotateCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ListPagination
            noun="invoice"
            page={page}
            pageSize={pageSize}
            total={data.total}
            itemCount={items.length}
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={paginationHandlers.onPageSizeChange}
          />
        </div>
      ) : null}
    </div>
  );
}
