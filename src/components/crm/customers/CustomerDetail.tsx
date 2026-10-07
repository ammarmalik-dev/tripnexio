"use client";

import { BillingDetailsForm } from "@/components/account/BillingDetailsForm";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, Mail, MessageCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { LeadStatusBadge } from "@/components/crm/LeadStatusBadge";
import { BookingStatusBadge } from "@/components/crm/BookingStatusBadge";
import { PaymentStatusBadge } from "@/components/crm/PaymentStatusBadge";
import { RefundStatusBadge } from "@/components/crm/RefundStatusBadge";
import { DocumentStatusBadge } from "@/components/crm/DocumentStatusBadge";
import { TaskStatusBadge } from "@/components/crm/TaskStatusBadge";
import { TaskPriorityBadge } from "@/components/crm/TaskPriorityBadge";
import { LeadTimeline } from "@/components/crm/LeadTimeline";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { PAX_TYPE_LABELS, SERVICE_TYPE_LABELS, TASK_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { Customer360Communication, Customer360Response } from "@/lib/customers/types";
import { formatCrmDate, formatCrmDateTime, formatMoney } from "./format";

type FetchState = "loading" | "success" | "error";

const PAYMENT_METHOD_LABELS: Record<string, string> = { GATEWAY: "Gateway", BANK_TRANSFER: "Bank transfer" };
const PAYMENT_PURPOSE_LABELS: Record<string, string> = { PRIMARY: "Primary", EXTRA: "Extra" };
const COMMUNICATION_STATUS_LABELS: Record<string, string> = {
  EMAIL_SENT: "Sent",
  EMAIL_SKIPPED: "Skipped",
  EMAIL_FAILED: "Failed",
  WHATSAPP_SENT: "Sent",
  WHATSAPP_SKIPPED: "Skipped",
  WHATSAPP_FAILED: "Failed",
};

const thClass = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-tertiary";
const tdClass = "px-3 py-2 align-top";
const rowClass = "border-b border-hairline last:border-b-0 hover:bg-ink-primary/[0.02]";

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-heading">
        {title}
        {typeof count === "number" ? (
          <span className="rounded-full bg-ink-primary/[0.06] px-2 py-0.5 text-xs font-medium text-ink-tertiary">{count}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

/**
 * Client-side pagination for one Customer 360 section: renders the first 10
 * entries and a pager once the section holds more than one default page
 * (sections are fully loaded; each keeps its own page).
 */
function Paged<T>({ items, noun, children }: { items: readonly T[]; noun: string; children: (pageItems: T[]) => ReactNode }) {
  const { pageItems, paginationProps } = useClientPagination(items);
  return (
    <>
      {children(pageItems)}
      {items.length > DEFAULT_PAGE_SIZE ? <ListPagination className="mt-3" noun={noun} {...paginationProps} /> : null}
    </>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-tertiary">{children}</p>;
}

function NoAccess() {
  return (
    <p className="flex items-center gap-1.5 text-sm text-ink-tertiary">
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      Your role doesn&apos;t have access to this section.
    </p>
  );
}

function TableWrap({ children, minWidth = "min-w-[560px]" }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", minWidth)}>{children}</table>
    </div>
  );
}

function BookingLink({ id, label }: { id: string; label: string }) {
  return (
    <Link href={`/crm/bookings/${id}`} className="font-medium text-ink-accent hover:underline">
      {label}
    </Link>
  );
}

function CommunicationRow({ item }: { item: Customer360Communication }) {
  const inbound = item.direction === "INBOUND";
  const Icon = item.channel === "EMAIL" ? Mail : MessageCircle;
  return (
    <li className="flex gap-3">
      <span
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.channel === "EMAIL" ? "bg-accent" : "bg-success")}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-primary">
          <Icon className="h-3.5 w-3.5 text-ink-tertiary" aria-hidden="true" />
          <span className="sr-only">{item.channel === "EMAIL" ? "Email" : "WhatsApp"}:</span>
          <span className="font-medium">{inbound ? "Customer" : (item.sentBy ?? "Automated")}</span>
          {item.status ? (
            <span className="text-xs text-ink-tertiary">· {COMMUNICATION_STATUS_LABELS[item.status] ?? item.status}</span>
          ) : null}
        </p>
        {item.body ? <p className="whitespace-pre-wrap break-words text-sm text-ink-secondary">{item.body}</p> : null}
        <p className="text-xs text-ink-tertiary">{formatCrmDateTime(item.timestamp)}</p>
      </div>
    </li>
  );
}

/**
 * CRM.md §23 — Customer 360: profile, leads, bookings, passengers,
 * quotations (selling price only — vendor cost/margin never reach this
 * payload), payments, refunds, documents, communications, follow-up tasks
 * and the combined activity timeline. Staff can move customer → lead →
 * booking via the links in each section.
 */
export function CustomerDetail({ customerId }: { customerId: string }) {
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<Customer360Response | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      setState("loading");
      try {
        const result = await getJson<Customer360Response>(`/api/customers/${customerId}`);
        if (cancelled) return;
        setData(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this customer. Please try again.");
        setState("error");
      }
    }

    void loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [customerId, reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading customer">
        <Skeleton className="h-24 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <ErrorState
          title="Couldn't load this customer"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const { customer, leads, bookings, passengers, quotations, payments, refunds, documents, communications, tasks, timeline } =
    data;
  const leadRefById = new Map(leads.map((lead) => [lead.id, lead.referenceId]));

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-tertiary">Customer</p>
          <h1 className="text-xl font-semibold text-ink-heading">{customer.name}</h1>
          <p className="text-xs text-ink-tertiary">Customer since {formatCrmDate(customer.createdAt)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <Stat label="Leads" value={leads.length} />
          <Stat label="Bookings" value={bookings ? bookings.length : "—"} />
          <Stat label="Passengers" value={passengers.length} />
          <Stat label="Documents" value={documents ? documents.length : "—"} />
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Section title="Leads" count={leads.length}>
            {leads.length === 0 ? (
              <Muted>No leads for this customer.</Muted>
            ) : (
              <Paged items={leads} noun="lead">
                {(rows) => (
              <TableWrap>
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={thClass}>Reference</th>
                    <th className={thClass}>Service</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Source</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((lead) => (
                    <tr key={lead.id} className={rowClass}>
                      <td className={tdClass}>
                        <Link href={`/crm/leads/${lead.id}`} className="font-medium text-ink-accent hover:underline">
                          {lead.referenceId}
                        </Link>
                      </td>
                      <td className={cn(tdClass, "text-ink-secondary")}>{SERVICE_TYPE_LABELS[lead.serviceType]}</td>
                      <td className={tdClass}>
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className={cn(tdClass, "text-ink-secondary")}>{lead.source ?? "—"}</td>
                      <td className={cn(tdClass, "text-ink-tertiary")}>{formatCrmDate(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
                )}
              </Paged>
            )}
          </Section>

          <Section title="Bookings" count={bookings?.length}>
            {bookings === null ? (
              <NoAccess />
            ) : bookings.length === 0 ? (
              <Muted>No bookings yet.</Muted>
            ) : (
              <Paged items={bookings} noun="booking">
                {(rows) => (
              <TableWrap>
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={thClass}>Booking ID</th>
                    <th className={thClass}>Lead</th>
                    <th className={thClass}>Service</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((booking) => (
                    <tr key={booking.id} className={rowClass}>
                      <td className={tdClass}>
                        <BookingLink id={booking.id} label={booking.bookingId} />
                      </td>
                      <td className={tdClass}>
                        <Link href={`/crm/leads/${booking.leadId}`} className="text-ink-accent hover:underline">
                          {leadRefById.get(booking.leadId) ?? "View lead"}
                        </Link>
                      </td>
                      <td className={cn(tdClass, "text-ink-secondary")}>{SERVICE_TYPE_LABELS[booking.serviceType]}</td>
                      <td className={tdClass}>
                        <BookingStatusBadge status={booking.status} />
                      </td>
                      <td className={cn(tdClass, "text-ink-tertiary")}>{formatCrmDate(booking.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
                )}
              </Paged>
            )}
          </Section>

          <Section title="Quotations" count={quotations?.length}>
            {quotations === null ? (
              <NoAccess />
            ) : quotations.length === 0 ? (
              <Muted>No quotations yet.</Muted>
            ) : (
              <Paged items={quotations} noun="quotation">
                {(rows) => (
              <TableWrap>
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={thClass}>Lead</th>
                    <th className={thClass}>Service</th>
                    <th className={thClass}>Details</th>
                    <th className={cn(thClass, "text-right")}>Selling price</th>
                    <th className={thClass}>State</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((quotation) => (
                    <tr key={quotation.id} className={rowClass}>
                      <td className={tdClass}>
                        <Link href={`/crm/leads/${quotation.leadId}`} className="text-ink-accent hover:underline">
                          {quotation.leadReferenceId || "View lead"}
                        </Link>
                      </td>
                      <td className={cn(tdClass, "text-ink-secondary")}>{SERVICE_TYPE_LABELS[quotation.serviceType]}</td>
                      <td className={cn(tdClass, "text-ink-secondary")}>
                        {[quotation.airline, quotation.route].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className={cn(tdClass, "text-right font-medium tabular-nums text-ink-primary")}>
                        {formatMoney(quotation.sellingPrice)}
                        {quotation.couponDiscount ? (
                          <span className="block text-xs font-normal text-ink-tertiary">
                            − {formatMoney(quotation.couponDiscount)} coupon
                          </span>
                        ) : null}
                      </td>
                      <td className={tdClass}>
                        <QuotationState selected={quotation.isSelected} expired={quotation.isExpired} />
                      </td>
                      <td className={cn(tdClass, "text-ink-tertiary")}>{formatCrmDate(quotation.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
                )}
              </Paged>
            )}
          </Section>

          <Section title="Payments" count={payments?.length}>
            {payments === null ? (
              <NoAccess />
            ) : payments.length === 0 ? (
              <Muted>No payments yet.</Muted>
            ) : (
              <Paged items={payments} noun="payment">
                {(rows) => (
              <TableWrap minWidth="min-w-[640px]">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={thClass}>Booking</th>
                    <th className={thClass}>Type</th>
                    <th className={cn(thClass, "text-right")}>Total</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Invoice</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((payment) => (
                    <tr key={payment.id} className={rowClass}>
                      <td className={tdClass}>
                        <BookingLink id={payment.bookingId} label={payment.bookingDisplayId || "View booking"} />
                      </td>
                      <td className={cn(tdClass, "text-ink-secondary")}>
                        {PAYMENT_PURPOSE_LABELS[payment.purpose] ?? payment.purpose}
                        <span className="block text-xs text-ink-tertiary">
                          {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                        </span>
                      </td>
                      <td className={cn(tdClass, "text-right font-medium tabular-nums text-ink-primary")}>
                        {formatMoney(payment.total)}
                        <span className="block text-xs font-normal text-ink-tertiary">
                          Base {formatMoney(payment.amount)} · GST {formatMoney(payment.gstAmount)}
                        </span>
                      </td>
                      <td className={tdClass}>
                        <PaymentStatusBadge status={payment.status} />
                      </td>
                      <td className={cn(tdClass, "text-ink-secondary")}>{payment.invoiceNumber ?? "—"}</td>
                      <td className={cn(tdClass, "text-ink-tertiary")}>{formatCrmDate(payment.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
                )}
              </Paged>
            )}
          </Section>

          <Section title="Refunds" count={refunds?.length}>
            {refunds === null ? (
              <NoAccess />
            ) : refunds.length === 0 ? (
              <Muted>No refunds.</Muted>
            ) : (
              <Paged items={refunds} noun="refund">
                {(rows) => (
              <TableWrap>
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={thClass}>Booking</th>
                    <th className={cn(thClass, "text-right")}>Refund amount</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Reason</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((refund) => (
                    <tr key={refund.id} className={rowClass}>
                      <td className={tdClass}>
                        {refund.bookingId ? (
                          <BookingLink id={refund.bookingId} label={refund.bookingDisplayId || "View booking"} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={cn(tdClass, "text-right font-medium tabular-nums text-ink-primary")}>
                        {formatMoney(refund.refundAmount)}
                      </td>
                      <td className={tdClass}>
                        <RefundStatusBadge status={refund.status} />
                      </td>
                      <td className={cn(tdClass, "text-ink-secondary")}>{refund.reason ?? "—"}</td>
                      <td className={cn(tdClass, "text-ink-tertiary")}>{formatCrmDate(refund.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
                )}
              </Paged>
            )}
          </Section>

          <Section title="Documents" count={documents?.length}>
            {documents === null ? (
              <NoAccess />
            ) : documents.length === 0 ? (
              <Muted>No documents yet.</Muted>
            ) : (
              <Paged items={documents} noun="document">
                {(rows) => (
              <TableWrap>
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Passenger</th>
                    <th className={thClass}>Booking</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((document) => (
                    <tr key={document.id} className={rowClass}>
                      <td className={cn(tdClass, "font-medium text-ink-primary")}>{document.type}</td>
                      <td className={cn(tdClass, "text-ink-secondary")}>{document.passengerName ?? "—"}</td>
                      <td className={tdClass}>
                        {document.bookingId ? (
                          <BookingLink id={document.bookingId} label={document.bookingDisplayId ?? "View booking"} />
                        ) : (
                          <span className="text-ink-tertiary">—</span>
                        )}
                      </td>
                      <td className={tdClass}>
                        <DocumentStatusBadge status={document.status} />
                        {document.deliveredAt ? (
                          <span className="mt-1 block text-xs text-ink-tertiary">
                            Delivered {formatCrmDate(document.deliveredAt)}
                          </span>
                        ) : null}
                      </td>
                      <td className={cn(tdClass, "text-ink-tertiary")}>{formatCrmDate(document.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
                )}
              </Paged>
            )}
          </Section>

          <Section title="Timeline" count={timeline.length}>
            <p className="mb-3 text-xs text-ink-tertiary">
              Newest first · everything recorded against this customer, their leads, quotations, bookings, payments,
              refunds, documents and passengers.
              {data.truncated.timeline ? " Showing the most recent 200 entries." : ""}
            </p>
            <Paged items={timeline} noun="timeline event">
              {(rows) => <LeadTimeline entries={rows} />}
            </Paged>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Profile">
            <dl className="flex flex-col gap-2 text-sm">
              <ProfileRow label="Name" value={customer.name} />
              <ProfileRow label="Mobile" value={customer.mobile} />
              <ProfileRow label="Email" value={customer.email ?? "—"} />
              <ProfileRow label="Online account" value={customer.hasAccount ? "Registered" : "Guest (no login)"} />
              <ProfileRow label="Created" value={formatCrmDate(customer.createdAt)} />
              <ProfileRow label="Last updated" value={formatCrmDate(customer.updatedAt)} />
            </dl>
          </Section>

          <Section title="Billing details (invoice)">
            <BillingDetailsForm
              endpoint={`/api/customers/${customer.id}/billing`}
              initial={{ billingAddress: customer.billingAddress, billingStateCode: customer.billingStateCode, gstin: customer.gstin }}
            />
          </Section>

          <Section title="Passengers" count={passengers.length}>
            {passengers.length === 0 ? (
              <Muted>No passengers on file.</Muted>
            ) : (
              <Paged items={passengers} noun="passenger">
                {(rows) => (
              <ul className="flex flex-col gap-3">
                {rows.map((passenger) => (
                  <li key={passenger.id} className="rounded-lg border border-hairline p-3">
                    <p className="text-sm font-medium text-ink-primary">{passenger.fullName}</p>
                    <p className="text-xs text-ink-tertiary">
                      {PAX_TYPE_LABELS[passenger.paxType]}
                      {passenger.nationality ? ` · ${passenger.nationality}` : ""}
                      {passenger.dob ? ` · DOB ${formatCrmDate(passenger.dob)}` : ""}
                    </p>
                    <p className="text-xs text-ink-secondary">Passport: {passenger.passportNumber ?? "—"}</p>
                  </li>
                ))}
              </ul>
                )}
              </Paged>
            )}
          </Section>

          <Section title="Follow-ups & Tasks" count={tasks?.length}>
            {tasks === null ? (
              <NoAccess />
            ) : tasks.length === 0 ? (
              <Muted>No follow-ups or tasks.</Muted>
            ) : (
              <Paged items={tasks} noun="task">
                {(rows) => (
              <ul className="flex flex-col gap-3">
                {rows.map((task) => (
                  <li key={task.id} className="flex flex-col gap-1 rounded-lg border border-hairline p-3">
                    <p className="text-sm font-medium text-ink-primary">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TaskStatusBadge status={task.status} />
                      <TaskPriorityBadge priority={task.priority} />
                    </div>
                    <p className="text-xs text-ink-tertiary">
                      {TASK_TYPE_LABELS[task.type]}
                      {task.dueDate ? ` · Due ${formatCrmDate(task.dueDate)}` : ""}
                      {` · ${task.assignedTo ?? "Unassigned"}`}
                    </p>
                    {task.reason ? <p className="text-xs text-ink-secondary">{task.reason}</p> : null}
                    {task.bookingId ? (
                      <Link href={`/crm/bookings/${task.bookingId}`} className="text-xs text-ink-accent hover:underline">
                        Open booking
                      </Link>
                    ) : task.leadId ? (
                      <Link href={`/crm/leads/${task.leadId}`} className="text-xs text-ink-accent hover:underline">
                        Open lead {leadRefById.get(task.leadId) ?? ""}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
                )}
              </Paged>
            )}
          </Section>

          <Section title="Communications" count={communications.length}>
            {communications.length === 0 ? (
              <Muted>No emails or WhatsApp messages recorded.</Muted>
            ) : (
              <>
                <p className="mb-3 text-xs text-ink-tertiary">
                  Newest first. To send a message, open one of the customer&apos;s leads.
                  {data.truncated.communications ? " Showing the most recent 100." : ""}
                </p>
                <Paged items={communications} noun="message">
                {(rows) => (
              <ul className="flex max-h-[32rem] flex-col gap-4 overflow-y-auto pr-1">
                  {rows.map((item) => (
                    <CommunicationRow key={`${item.channel}-${item.id}`} item={item} />
                  ))}
                </ul>
                )}
              </Paged>
              </>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <div>
      <Link
        href="/crm/customers"
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary transition-colors duration-150 hover:text-ink-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to customers
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-ink-tertiary">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-ink-heading">{value}</dd>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline pb-2 last:border-b-0 last:pb-0">
      <dt className="text-xs text-ink-tertiary">{label}</dt>
      <dd className="break-all text-right font-medium text-ink-primary">{value}</dd>
    </div>
  );
}

function QuotationState({ selected, expired }: { selected: boolean; expired: boolean }) {
  const label = selected ? "Selected" : expired ? "Expired" : "Open";
  const style = selected
    ? "bg-success/10 text-success"
    : expired
      ? "bg-ink-primary/[0.06] text-ink-tertiary"
      : "bg-accent/10 text-accent-on-light";
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", style)}>
      {label}
    </span>
  );
}
