"use client";

import { useEffect, useState } from "react";
import { PurgedFileTag } from "./PurgedFileTag";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, RotateCw } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { DocumentStatusControl } from "./DocumentStatusControl";
import { DashboardFilterChip } from "./DashboardFilterChip";
import { DateRangeFilter } from "./DateRangeFilter";
import { useDateRangeFilter } from "./useDateRangeFilter";
import { DOCUMENT_STATUS_OPTIONS, DOCUMENT_STATUS_LABELS } from "@/lib/crm/labels";
import { ListPagination } from "./ListPagination";
import { usePaginationState } from "./usePagination";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { DocumentStatus } from "../../generated/prisma/enums";

interface DocumentListItem {
  id: string;
  type: string;
  status: DocumentStatus;
  rejectionReason?: string | null;
  fileUrl: string | null;
  /** P27 - set when the retention job deleted the file. */
  purgedAt?: string | null;
  createdAt: string;
  passenger: { id: string; fullName: string } | null;
  booking: { id: string; bookingId: string; leadReferenceId: string } | null;
  customer: { name: string; mobile: string } | null;
}

interface DocumentListResponse {
  items: DocumentListItem[];
  total: number;
}

type SortOption = "createdAt_desc" | "createdAt_asc";
type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function DocumentReviewQueue() {
  // Step 53 — read once on mount, so a Command Centre KPI card's link
  // (e.g. /crm/documents?status=REQUIRED,MISSING for "Documents Pending")
  // lands pre-filtered.
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear: clearDates } = useDateRangeFilter(
    searchParams.get("dateFrom") ?? "",
    searchParams.get("dateTo") ?? ""
  );
  // Client corrections 2026-10-05: no page search box (one global 360 search); a ?search= link still pre-filters.
  const search = searchParams.get("search") ?? "";
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<DocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { page, pageSize, resetPage, paginationHandlers } = usePaginationState();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, DocumentStatus>>({});
  const [reasonOverrides, setReasonOverrides] = useState<Record<string, string | null>>({});


  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (search) params.set("search", search);
        params.set("sort", sort);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const result = await getJson<DocumentListResponse>(`/api/documents?${params.toString()}`);
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setStatusOverrides({});
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load documents. Please try again.");
        setState("error");
      }
    }

    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [status, dateFrom, dateTo, search, sort, page, pageSize, refreshNonce]);

  const missingCount = items.filter((item) => (statusOverrides[item.id] ?? item.status) === "MISSING").length;

  return (
    <div className="flex flex-col gap-4">
      {missingCount > 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {missingCount} document{missingCount === 1 ? "" : "s"} on this page flagged missing — queued for customer
          notification (Phase 5).
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">

        <label htmlFor="filter-document-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-document-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetPage();
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[150px]")}
        >
          <option value="">All statuses</option>
          {DOCUMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="sort-documents" className="sr-only">
          Sort by created date
        </label>
        <select
          id="sort-documents"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as SortOption);
            resetPage();
          }}
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

      <DateRangeFilter
        idPrefix="document"
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
        label={status.includes(",") ? status.split(",").map((s) => DOCUMENT_STATUS_LABELS[s as DocumentStatus] ?? s).join(", ") : undefined}
        clearHref="/crm/documents"
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
          title="Couldn't load documents"
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
          title="No documents match these filters"
          description="Try different filters, or clear them."
        />
      ) : null}

      {state === "success" && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Linked To</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((document) => (
                <tr key={document.id} className="border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]">
                  <td className="px-4 py-3 font-medium text-ink-primary">
                    <span className="flex flex-wrap items-center gap-2">
                      {document.type}
                      <PurgedFileTag purgedAt={document.purgedAt} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-tertiary">
                    {document.booking ? (
                      <Link href={`/crm/bookings/${document.booking.id}`} className="text-ink-accent hover:underline">
                        {document.booking.bookingId}
                      </Link>
                    ) : null}
                    {document.passenger ? <div>{document.passenger.fullName}</div> : null}
                    {!document.booking && !document.passenger ? "—" : null}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {document.customer ? (
                      <div className="flex flex-col">
                        <span>{document.customer.name}</span>
                        <span className="text-xs text-ink-tertiary">{document.customer.mobile}</span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <DocumentStatusControl
                      documentId={document.id}
                      status={statusOverrides[document.id] ?? document.status}
                      rejectionReason={reasonOverrides[document.id] ?? document.rejectionReason}
                      onChanged={(next, reason) => {
                        setStatusOverrides((current) => ({ ...current, [document.id]: next }));
                        setReasonOverrides((current) => ({ ...current, [document.id]: reason ?? null }));
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-ink-tertiary">{formatDate(document.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "success" ? (
        <ListPagination
          noun="document"
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
