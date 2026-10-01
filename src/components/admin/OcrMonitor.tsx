"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCw, RefreshCcw, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination, usePaginationState } from "@/components/crm/usePagination";
import { FilterSelect, ListStateView, type FetchState } from "./MonitoringControls";
import { formatDateTime } from "@/lib/admin/monitoring";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { OcrExtractionStatus, DocumentExtractionType } from "../../generated/prisma/enums";

interface TotalsBucket {
  PENDING_REVIEW: number;
  CONFIRMED: number;
  REJECTED: number;
  extracted: number;
  failed: number;
}

interface LinkedRecords {
  booking: { id: string; reference: string } | null;
  passenger: { id: string; name: string; customerId: string } | null;
}

interface OcrJob extends LinkedRecords {
  id: string;
  extractionType: DocumentExtractionType;
  provider: string;
  status: OcrExtractionStatus;
  mrzValid: boolean;
  createdAt: string;
  reviewedAt: string | null;
  documentId: string;
  documentType: string;
  retryable: boolean;
}

interface OcrFailure extends LinkedRecords {
  id: string;
  documentId: string;
  documentType: string | null;
  note: string | null;
  timestamp: string;
  resolved: boolean;
  retryable: boolean;
}

interface OcrMonitorResponse {
  totals: { allTime: TotalsBucket; last7d: TotalsBucket; last24h: TotalsBucket };
  jobs: { items: OcrJob[]; total: number; page: number; pageSize: number };
  failures: OcrFailure[];
}

const EMPTY_FAILURES: OcrFailure[] = [];


const STATUS_LABELS: Record<OcrExtractionStatus, string> = {
  PENDING_REVIEW: "Pending review",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};

const STATUS_STYLES: Record<OcrExtractionStatus, string> = {
  PENDING_REVIEW: "bg-warning/10 text-warning",
  CONFIRMED: "bg-success/10 text-success",
  REJECTED: "bg-error/10 text-error",
};

const TYPE_LABELS: Record<DocumentExtractionType, string> = {
  PASSPORT: "Passport",
  TICKET: "Ticket",
  VISA: "Visa",
};

const TOTAL_COLUMNS: { key: keyof TotalsBucket; label: string }[] = [
  { key: "extracted", label: "Extracted (success)" },
  { key: "PENDING_REVIEW", label: "Pending review" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "REJECTED", label: "Rejected" },
  { key: "failed", label: "Failed" },
];

function LinkedCell({ booking, passenger }: LinkedRecords) {
  if (!booking && !passenger) return <span className="text-xs text-ink-tertiary">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {booking ? (
        <Link href={`/crm/bookings/${booking.id}`} className="font-medium text-ink-accent hover:underline">
          {booking.reference}
        </Link>
      ) : null}
      {passenger ? (
        <Link href={`/crm/customers/${passenger.customerId}`} className="text-ink-secondary hover:underline">
          {passenger.name}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * P24 item 8 — Admin → OCR Monitor. Retry calls the EXISTING
 * POST /api/documents/[id]/run-ocr (needs documents.edit, enforced there),
 * which re-runs passport OCR only — ticket/visa documents are re-read by
 * re-uploading the file from the booking page, so their rows link there
 * instead of offering Retry.
 */
export function OcrMonitor() {
  const [status, setStatus] = useState("");
  const [extractionType, setExtractionType] = useState("");
  const { page, pageSize, setPage, paginationHandlers } = usePaginationState();
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<OcrMonitorResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [retryingDocumentId, setRetryingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMonitor() {
      setState("loading");
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (extractionType) params.set("extractionType", extractionType);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      try {
        const result = await getJson<OcrMonitorResponse>(`/api/admin/ocr-monitor?${params.toString()}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load OCR activity. Please try again.");
        setState("error");
      }
    }
    void loadMonitor();
    return () => {
      cancelled = true;
    };
  }, [status, extractionType, page, pageSize, refreshNonce]);

  async function retry(documentId: string) {
    setRetryingDocumentId(documentId);
    try {
      await postJson(`/api/documents/${documentId}/run-ocr`, {});
      toast.success("OCR re-run — a new extraction is waiting for review.");
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't re-run OCR. Please try again.");
      // A failed re-run writes a fresh OCR_FAILED row — refresh so it shows up.
      setRefreshNonce((current) => current + 1);
    } finally {
      setRetryingDocumentId(null);
    }
  }

  /** A plain render helper (not a nested component) so it never remounts between renders. */
  function renderRetry(documentId: string, retryable: boolean, booking: LinkedRecords["booking"]) {
    if (retryable) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void retry(documentId)}
          disabled={retryingDocumentId !== null}
          isLoading={retryingDocumentId === documentId}
          aria-label="Retry OCR for this document"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      );
    }
    return (
      <span className="text-xs text-ink-tertiary">
        {booking ? (
          <Link href={`/crm/bookings/${booking.id}`} className="text-ink-accent hover:underline">
            Re-upload on booking
          </Link>
        ) : (
          "Re-upload to retry"
        )}
      </span>
    );
  }

  const jobs = data?.jobs.items ?? [];
  const failures = data?.failures ?? EMPTY_FAILURES;
  const failurePagination = useClientPagination(failures);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="ocr-totals-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ocr-totals-heading" className="text-lg font-semibold text-ink-heading">
            Totals
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRefreshNonce((current) => current + 1)} disabled={state === "loading"}>
            <RotateCw className={cn("h-4 w-4", state === "loading" && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        </div>
        <ListStateView
          state={state}
          isEmpty={false}
          errorTitle="Couldn't load OCR activity"
          errorMessage={errorMessage}
          emptyTitle=""
          onRetry={() => setRefreshNonce((current) => current + 1)}
          rows={3}
        >
          {data ? (
            <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                    <th scope="col" className="px-4 py-3">Period</th>
                    {TOTAL_COLUMNS.map((column) => (
                      <th key={column.key} scope="col" className="px-4 py-3 text-right">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Last 24 hours", data.totals.last24h],
                      ["Last 7 days", data.totals.last7d],
                      ["All time", data.totals.allTime],
                    ] as const
                  ).map(([label, bucket]) => (
                    <tr key={label} className="border-b border-hairline last:border-b-0">
                      <th scope="row" className="px-4 py-3 text-left font-medium text-ink-primary">
                        {label}
                      </th>
                      {TOTAL_COLUMNS.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            "px-4 py-3 text-right tabular-nums",
                            column.key === "failed" && bucket.failed > 0 ? "font-semibold text-error" : "text-ink-secondary"
                          )}
                        >
                          {bucket[column.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ListStateView>
      </section>

      {state === "success" ? (
        <section aria-labelledby="ocr-failures-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="ocr-failures-heading" className="text-lg font-semibold text-ink-heading">
              Recent failures
            </h2>
            <p className="text-sm text-ink-tertiary">
              The latest {failures.length} provider errors (OCR_FAILED audit rows). A failure is marked resolved once a later extraction for the
              same document succeeded.
            </p>
          </div>
          {failures.length === 0 ? (
            <p className="rounded-xl border border-hairline bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">No OCR failures recorded.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                    <th scope="col" className="px-4 py-3">Time</th>
                    <th scope="col" className="px-4 py-3">Document</th>
                    <th scope="col" className="px-4 py-3">Booking / Passenger</th>
                    <th scope="col" className="px-4 py-3">Error</th>
                    <th scope="col" className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {failurePagination.pageItems.map((failure) => (
                    <tr key={failure.id} className="border-b border-hairline align-top last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-tertiary">{formatDateTime(failure.timestamp)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-primary">{failure.documentType ?? "Deleted document"}</div>
                        {failure.resolved ? <div className="text-xs text-success">Resolved by a later run</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <LinkedCell booking={failure.booking} passenger={failure.passenger} />
                      </td>
                      <td className="max-w-[360px] break-words px-4 py-3 text-xs text-ink-secondary">{failure.note ?? "—"}</td>
                      <td className="px-4 py-3">
                        {failure.resolved ? (
                          <span className="text-xs text-ink-tertiary">—</span>
                        ) : (
                          renderRetry(failure.documentId, failure.retryable, failure.booking)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ListPagination noun="failure" {...failurePagination.paginationProps} />
        </section>
      ) : null}

      <section aria-labelledby="ocr-jobs-heading" className="flex flex-col gap-3">
        <h2 id="ocr-jobs-heading" className="text-lg font-semibold text-ink-heading">
          Extraction jobs
        </h2>
        <div className="grid gap-3 rounded-xl border border-hairline bg-surface-1 p-4 sm:grid-cols-2">
          <FilterSelect
            id="ocr-status"
            label="Status"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={(Object.keys(STATUS_LABELS) as OcrExtractionStatus[]).map((value) => ({ value, label: STATUS_LABELS[value] }))}
            allLabel="All statuses"
          />
          <FilterSelect
            id="ocr-type"
            label="Document type"
            value={extractionType}
            onChange={(value) => {
              setExtractionType(value);
              setPage(1);
            }}
            options={(Object.keys(TYPE_LABELS) as DocumentExtractionType[]).map((value) => ({ value, label: TYPE_LABELS[value] }))}
            allLabel="All types"
          />
        </div>
        <ListStateView
          state={state}
          isEmpty={jobs.length === 0}
          errorTitle="Couldn't load extraction jobs"
          errorMessage={errorMessage}
          emptyTitle="No extraction jobs match these filters"
          emptyDescription="Jobs appear here as passports, tickets, and visas are uploaded."
          onRetry={() => setRefreshNonce((current) => current + 1)}
        >
          <div className="overflow-x-auto rounded-xl border border-hairline bg-surface-1">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary">
                  <th scope="col" className="px-4 py-3">Created</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Provider</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">MRZ</th>
                  <th scope="col" className="px-4 py-3">Booking / Passenger</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-hairline align-top last:border-b-0 hover:bg-ink-primary/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-tertiary">{formatDateTime(job.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-primary">{TYPE_LABELS[job.extractionType]}</div>
                      <div className="text-xs text-ink-tertiary">{job.documentType}</div>
                    </td>
                    <td className="max-w-[200px] break-words px-4 py-3 text-xs text-ink-secondary">{job.provider}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLES[job.status])}>
                        {STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {job.extractionType !== "PASSPORT" ? (
                        <span className="text-xs text-ink-tertiary">n/a</span>
                      ) : job.mrzValid ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-warning">
                          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                          Not verified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LinkedCell booking={job.booking} passenger={job.passenger} />
                    </td>
                    <td className="px-4 py-3">
                      {job.status === "REJECTED" ? (
                        renderRetry(job.documentId, job.retryable, job.booking)
                      ) : (
                        <span className="text-xs text-ink-tertiary">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ListStateView>
        {state === "success" && data ? (
          <ListPagination noun="job" page={data.jobs.page} pageSize={data.jobs.pageSize} total={data.jobs.total} itemCount={jobs.length} {...paginationHandlers} />
        ) : null}
      </section>
    </div>
  );
}
