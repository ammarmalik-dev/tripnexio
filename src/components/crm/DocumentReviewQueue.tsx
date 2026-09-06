"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, RotateCw } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { DocumentStatusControl } from "./DocumentStatusControl";
import { DOCUMENT_STATUS_OPTIONS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { DocumentStatus } from "../../generated/prisma/enums";

interface DocumentListItem {
  id: string;
  type: string;
  status: DocumentStatus;
  fileUrl: string | null;
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
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("createdAt_desc");
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<DocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, DocumentStatus>>({});

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      setState("loading");
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (search) params.set("search", search);
        params.set("sort", sort);

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
  }, [status, search, sort, refreshNonce]);

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
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
          <label htmlFor="document-search" className="sr-only">
            Search by document type, booking id, or passenger name
          </label>
          <input
            id="document-search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by document type, booking id, or passenger name…"
            className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
          />
        </div>

        <label htmlFor="filter-document-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="filter-document-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
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
          description="Try a different search term or clear the filters."
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
                  <td className="px-4 py-3 font-medium text-ink-primary">{document.type}</td>
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
                      onChanged={(next) => setStatusOverrides((current) => ({ ...current, [document.id]: next }))}
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
        <p className="text-xs text-ink-tertiary">
          Showing {items.length} of {total} document{total === 1 ? "" : "s"}
        </p>
      ) : null}
    </div>
  );
}
