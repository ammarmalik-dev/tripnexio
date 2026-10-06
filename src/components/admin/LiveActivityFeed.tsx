"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Pause, Play, RotateCw, ListChecks, CalendarCheck, CreditCard, MessageCircle, ScanText, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { LeadStatusBadge } from "@/components/crm/LeadStatusBadge";
import { BookingStatusBadge } from "@/components/crm/BookingStatusBadge";
import { PaymentStatusBadge } from "@/components/crm/PaymentStatusBadge";
import { ListStateView, type FetchState } from "./MonitoringControls";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { formatDateTime } from "@/lib/admin/monitoring";
import { formatCurrency } from "@/lib/format-currency";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type {
  ServiceType,
  LeadStatus,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  OcrExtractionStatus,
  DocumentExtractionType,
  WhatsAppMessageDirection,
} from "../../generated/prisma/enums";

interface LiveActivityResponse {
  generatedAt: string;
  leads: { id: string; reference: string; serviceType: ServiceType; status: LeadStatus; source: string | null; customerName: string; createdAt: string }[];
  payments: {
    id: string;
    status: PaymentStatus;
    method: PaymentMethod;
    total: number;
    createdAt: string;
    booking: { id: string; bookingId: string };
  }[];
  bookings: { id: string; bookingId: string; status: BookingStatus; serviceType: ServiceType; customerName: string; createdAt: string }[];
  conversations: {
    id: string;
    maskedNumber: string;
    customerName: string | null;
    state: string;
    serviceType: ServiceType | null;
    leadId: string | null;
    updatedAt: string;
    latestMessage: { direction: WhatsAppMessageDirection; preview: string | null; createdAt: string } | null;
  }[];
  emails: { id: string; action: "EMAIL_SENT" | "EMAIL_FAILED" | "EMAIL_SKIPPED"; entityType: string; entityId: string; note: string | null; timestamp: string }[];
  ocrJobs: {
    id: string;
    extractionType: DocumentExtractionType;
    status: OcrExtractionStatus;
    provider: string;
    mrzValid: boolean;
    bookingId: string | null;
    createdAt: string;
  }[];
}

const REFRESH_INTERVAL_MS = 30_000;

const OCR_STATUS_LABELS: Record<OcrExtractionStatus, string> = {
  PENDING_REVIEW: "Pending review",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
};

interface ActivityCardProps<T extends { id: string }> {
  title: string;
  /** Singular noun for the pagination summary, e.g. "lead". */
  noun: string;
  icon: ReactNode;
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
}

/** One activity type: the latest rows, 10 per page, with its own pager. */
function ActivityCard<T extends { id: string }>({ title, noun, icon, items, renderItem }: ActivityCardProps<T>) {
  const headingId = `live-${title.toLowerCase().replace(/\W+/g, "-")}`;
  const { pageItems, paginationProps } = useClientPagination(items);
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col rounded-xl border border-hairline bg-surface-1">
      <header className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
          {icon}
          {title}
        </h2>
        <span className="text-xs text-ink-tertiary">Last {items.length}</span>
      </header>
      {items.length === 0 ? (
        <EmptyState className="m-4" title={`No ${title.toLowerCase()} yet`} />
      ) : (
        <>
          <ul className="flex flex-col">
            {pageItems.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-2.5 text-sm last:border-b-0">
                {renderItem(item)}
              </li>
            ))}
          </ul>
          <ListPagination noun={noun} {...paginationProps} className="m-3 mt-auto" />
        </>
      )}
    </section>
  );
}

/**
 * P24 item 8 — Admin → Live Activity: the latest 20 of each activity type,
 * re-fetched every 30 seconds (paused on demand). The polling interval is
 * declared inside the effect and cleared in its cleanup, so pausing,
 * unmounting, or a manual refresh never leaves a stray timer running.
 */
export function LiveActivityFeed() {
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<LiveActivityResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      setRefreshing(true);
      try {
        const result = await getJson<LiveActivityResponse>("/api/admin/live-activity");
        if (cancelled) return;
        setData(result);
        setErrorMessage("");
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load live activity. Please try again.");
        // Keep showing the last good snapshot if there is one; only a first-load failure becomes the error state.
        setState((current) => (current === "success" ? "success" : "error"));
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    void loadActivity();
    const interval = paused ? null : setInterval(() => void loadActivity(), REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [paused, refreshNonce]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant={paused ? "primary" : "ghost"} size="sm" onClick={() => setPaused((current) => !current)} aria-pressed={paused}>
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          {paused ? "Resume auto-refresh" : "Pause auto-refresh"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRefreshNonce((current) => current + 1)} disabled={refreshing}>
          <RotateCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
          Refresh now
        </Button>
        <p className="text-xs text-ink-tertiary" aria-live="polite">
          {paused ? "Auto-refresh paused." : "Refreshing every 30 seconds."}
          {data ? ` Last updated ${formatDateTime(data.generatedAt)}.` : ""}
        </p>
      </div>

      {state === "success" && errorMessage ? (
        <p role="alert" className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          {errorMessage} Showing the last successful snapshot.
        </p>
      ) : null}

      <ListStateView
        state={state}
        isEmpty={false}
        errorTitle="Couldn't load live activity"
        errorMessage={errorMessage}
        emptyTitle=""
        onRetry={() => setRefreshNonce((current) => current + 1)}
        rows={8}
      >
        {data ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <ActivityCard
              title="Leads"
              noun="lead"
              icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
              items={data.leads}
              renderItem={(lead) => (
                <>
                  <div className="min-w-0">
                    <Link href={`/crm/leads/${lead.id}`} className="font-medium text-ink-accent hover:underline">
                      {lead.reference}
                    </Link>
                    <div className="truncate text-xs text-ink-tertiary">
                      {lead.customerName} · {SERVICE_TYPE_LABELS[lead.serviceType]}
                      {lead.source ? ` · ${lead.source}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <LeadStatusBadge status={lead.status} />
                    <span className="text-xs text-ink-tertiary">{formatDateTime(lead.createdAt)}</span>
                  </div>
                </>
              )}
            />

            <ActivityCard
              title="Payments"
              noun="payment"
              icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
              items={data.payments}
              renderItem={(payment) => (
                <>
                  <div className="min-w-0">
                    <div className="font-medium text-ink-primary">{formatCurrency(payment.total)}</div>
                    <div className="truncate text-xs text-ink-tertiary">
                      <Link href={`/admin/bookings/${payment.booking.id}`} className="text-ink-accent hover:underline">
                        {payment.booking.bookingId}
                      </Link>
                      {payment.method === "BANK_TRANSFER" ? " · Bank transfer" : " · Gateway"}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <PaymentStatusBadge status={payment.status} />
                    <span className="text-xs text-ink-tertiary">{formatDateTime(payment.createdAt)}</span>
                  </div>
                </>
              )}
            />

            <ActivityCard
              title="Bookings"
              noun="booking"
              icon={<CalendarCheck className="h-4 w-4" aria-hidden="true" />}
              items={data.bookings}
              renderItem={(booking) => (
                <>
                  <div className="min-w-0">
                    <Link href={`/admin/bookings/${booking.id}`} className="font-medium text-ink-accent hover:underline">
                      {booking.bookingId}
                    </Link>
                    <div className="truncate text-xs text-ink-tertiary">
                      {booking.customerName} · {SERVICE_TYPE_LABELS[booking.serviceType]}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <BookingStatusBadge status={booking.status} />
                    <span className="text-xs text-ink-tertiary">{formatDateTime(booking.createdAt)}</span>
                  </div>
                </>
              )}
            />

            <ActivityCard
              title="WhatsApp Conversations"
              noun="conversation"
              icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
              items={data.conversations}
              renderItem={(conversation) => (
                <>
                  <div className="min-w-0">
                    <div className="font-medium text-ink-primary">
                      {conversation.customerName ?? "Unknown"} <span className="text-xs font-normal text-ink-tertiary">{conversation.maskedNumber}</span>
                    </div>
                    {conversation.latestMessage ? (
                      <p className="line-clamp-2 text-xs text-ink-secondary">
                        <span className="font-medium">{conversation.latestMessage.direction === "INBOUND" ? "Customer: " : "TripNexio: "}</span>
                        {conversation.latestMessage.preview ?? ""}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-tertiary">No messages logged</p>
                    )}
                    <div className="text-xs text-ink-tertiary">
                      {conversation.state}
                      {conversation.serviceType ? ` · ${SERVICE_TYPE_LABELS[conversation.serviceType]}` : ""}
                      {conversation.leadId ? (
                        <>
                          {" · "}
                          <Link href={`/crm/leads/${conversation.leadId}`} className="text-ink-accent hover:underline">
                            Lead
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-ink-tertiary">
                    {formatDateTime(conversation.latestMessage?.createdAt ?? conversation.updatedAt)}
                  </span>
                </>
              )}
            />

            <ActivityCard
              title="OCR Jobs"
              noun="OCR job"
              icon={<ScanText className="h-4 w-4" aria-hidden="true" />}
              items={data.ocrJobs}
              renderItem={(job) => (
                <>
                  <div className="min-w-0">
                    <div className="font-medium text-ink-primary">
                      {job.extractionType.charAt(0) + job.extractionType.slice(1).toLowerCase()}
                      {job.extractionType === "PASSPORT" ? (
                        <span className={cn("ml-2 text-xs font-normal", job.mrzValid ? "text-success" : "text-warning")}>
                          {job.mrzValid ? "MRZ valid" : "MRZ not verified"}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-ink-tertiary">
                      {job.provider}
                      {job.bookingId ? (
                        <>
                          {" · "}
                          <Link href={`/admin/bookings/${job.bookingId}`} className="text-ink-accent hover:underline">
                            Booking
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-medium text-ink-secondary">{OCR_STATUS_LABELS[job.status]}</span>
                    <span className="text-xs text-ink-tertiary">{formatDateTime(job.createdAt)}</span>
                  </div>
                </>
              )}
            />

            <ActivityCard
              title="Emails"
              noun="email"
              icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              items={data.emails}
              renderItem={(email) => (
                <>
                  <div className="min-w-0">
                    <div className="font-medium text-ink-primary">{email.entityType}</div>
                    <p className="line-clamp-2 text-xs text-ink-secondary">{email.note ?? ""}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        email.action === "EMAIL_SENT" ? "text-success" : email.action === "EMAIL_FAILED" ? "text-error" : "text-ink-tertiary"
                      )}
                    >
                      {email.action === "EMAIL_SENT" ? "Sent" : email.action === "EMAIL_FAILED" ? "Failed" : "Skipped"}
                    </span>
                    <span className="text-xs text-ink-tertiary">{formatDateTime(email.timestamp)}</span>
                  </div>
                </>
              )}
            />
          </div>
        ) : null}
      </ListStateView>
    </div>
  );
}
