"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { LeadStatusControl } from "./LeadStatusControl";
import { LeadAssignmentControl } from "./LeadAssignmentControl";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { PassportExtractionReview } from "./PassportExtractionReview";
import { LeadTimeline } from "./LeadTimeline";
import { QuoteBuilder } from "./QuoteBuilder";
import { SERVICE_TYPE_LABELS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { humanizeKey } from "@/lib/crm/humanize";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import type { ServiceType, LeadStatus, BookingStatus, PaymentStatus, PaxType, DocumentStatus } from "../../generated/prisma/enums";

interface QuotationSummary {
  id: string;
  isSelected: boolean;
  isExpired: boolean;
}

interface PaymentItem {
  id: string;
  amount: string;
  gstAmount: string;
  gatewayFee: string;
  status: PaymentStatus;
  createdAt: string;
}

interface BookingItem {
  id: string;
  bookingId: string;
  status: BookingStatus;
  createdAt: string;
  payments: PaymentItem[];
}

interface PassengerDocument {
  id: string;
  type: string;
  status: DocumentStatus;
  fileUrl: string | null;
}

interface LeadPassenger {
  id: string;
  fullName: string;
  paxType: PaxType;
  nationality: string | null;
  documents: PassengerDocument[];
}

interface LeadDetailResponse {
  id: string;
  referenceId: string;
  serviceType: ServiceType;
  status: LeadStatus;
  source: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  assignedStaff: { id: string; name: string; email: string } | null;
  customer: {
    id: string;
    name: string;
    mobile: string;
    email: string | null;
    createdAt: string;
    passengers: { id: string; fullName: string; paxType: PaxType; nationality: string | null }[];
    otherLeads: { id: string; referenceId: string; serviceType: ServiceType; status: LeadStatus; createdAt: string }[];
    otherBookings: { id: string; bookingId: string; status: BookingStatus; createdAt: string }[];
  };
  passengers: LeadPassenger[];
  quotations: QuotationSummary[];
  bookings: BookingItem[];
  timeline: {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    note: string | null;
    timestamp: string;
    byUser: { name: string } | null;
  }[];
}

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function LeadDetail({ leadId, canReassignLeads }: { leadId: string; canReassignLeads: boolean }) {
  const [state, setState] = useState<FetchState>("loading");
  const [lead, setLead] = useState<LeadDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [creatingBooking, setCreatingBooking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLead() {
      setState("loading");
      try {
        const result = await getJson<LeadDetailResponse>(`/api/leads/${leadId}`);
        if (cancelled) return;
        setLead(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this lead. Please try again.");
        setState("error");
      }
    }

    void loadLead();
    return () => {
      cancelled = true;
    };
  }, [leadId, reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load this lead"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!lead) return null;

  const detailEntries = Object.entries(lead.details).filter(([key]) => key !== "passengerIds");
  const selectedQuotation = lead.quotations.find((quotation) => quotation.isSelected && !quotation.isExpired);
  const hasActiveBooking = lead.bookings.some((booking) => booking.status !== "CANCELLED");

  const handleCreateBooking = async () => {
    if (!selectedQuotation) return;
    setCreatingBooking(true);
    try {
      await postJson("/api/bookings", { quotationId: selectedQuotation.id });
      toast.success("Booking created.");
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create a booking. Please try again.");
    } finally {
      setCreatingBooking(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/crm/leads"
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary transition-colors duration-150 hover:text-ink-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Leads
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">
            {SERVICE_TYPE_LABELS[lead.serviceType]} · {lead.referenceId}
          </p>
          <h1 className="text-xl font-semibold text-ink-heading">{lead.customer.name}</h1>
          <p className="text-xs text-ink-tertiary">Submitted {formatDate(lead.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <LeadStatusControl
            leadId={lead.id}
            status={lead.status}
            onChanged={(status) => setLead((current) => (current ? { ...current, status } : current))}
          />
          <LeadAssignmentControl
            leadId={lead.id}
            assignedStaff={lead.assignedStaff}
            canReassign={canReassignLeads}
            onChanged={(assignedStaff) =>
              setLead((current) =>
                current
                  ? { ...current, assignedStaff: assignedStaff ? { ...assignedStaff, email: "" } : null }
                  : current
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Service Details</h2>
            {detailEntries.length === 0 ? (
              <p className="text-sm text-ink-tertiary">No captured details.</p>
            ) : (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {detailEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-4 border-b border-hairline py-2 sm:justify-start">
                    <dt className="text-xs text-ink-tertiary">{humanizeKey(key)}</dt>
                    <dd className="text-sm font-medium text-ink-primary">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Passengers &amp; Documents</h2>
            {lead.passengers.length === 0 ? (
              <p className="text-sm text-ink-tertiary">No passengers linked to this request.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {lead.passengers.map((passenger) => (
                  <div key={passenger.id} className="rounded-lg border border-hairline p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-primary">{passenger.fullName}</p>
                      <span className="text-xs text-ink-tertiary">
                        {PAX_TYPE_LABELS[passenger.paxType]}
                        {passenger.nationality ? ` · ${passenger.nationality}` : ""}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {passenger.documents.length === 0 ? (
                        <span className="text-xs text-ink-tertiary">No documents yet.</span>
                      ) : (
                        passenger.documents.map((document) => (
                          <div key={document.id} className="flex items-center gap-1.5">
                            <span className="text-xs text-ink-tertiary">{document.type}</span>
                            <DocumentStatusBadge status={document.status} />
                          </div>
                        ))
                      )}
                    </div>
                    <PassportExtractionReview passengerId={passenger.id} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <QuoteBuilder
            leadId={lead.id}
            serviceType={lead.serviceType}
            leadStatus={lead.status}
            onLeadChanged={() => setReloadNonce((current) => current + 1)}
          />

          {lead.bookings.length > 0 || selectedQuotation ? (
            <section className="rounded-xl border border-hairline bg-surface-1 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink-heading">Bookings &amp; Payments</h2>
                {selectedQuotation && !hasActiveBooking ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void handleCreateBooking()} isLoading={creatingBooking}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create Booking
                  </Button>
                ) : null}
              </div>
              {lead.bookings.length === 0 ? (
                <p className="text-sm text-ink-tertiary">No booking yet — create one from the selected quotation above.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {lead.bookings.map((booking) => (
                    <div key={booking.id} className="rounded-lg border border-hairline p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/crm/bookings/${booking.id}`} className="text-sm font-medium text-ink-accent hover:underline">
                          {booking.bookingId}
                        </Link>
                        <BookingStatusBadge status={booking.status} />
                      </div>
                      {booking.payments.length > 0 ? (
                        <div className="mt-2 flex flex-col gap-1">
                          {booking.payments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between text-xs text-ink-tertiary">
                              <span>
                                ₹{payment.amount} + GST ₹{payment.gstAmount} + fee ₹{payment.gatewayFee}
                              </span>
                              <span>{payment.status}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Customer 360</h2>
            <div className="flex flex-col gap-1 border-b border-hairline pb-3">
              <p className="text-sm font-medium text-ink-primary">{lead.customer.name}</p>
              <p className="text-xs text-ink-tertiary">{lead.customer.mobile}</p>
              {lead.customer.email ? <p className="text-xs text-ink-tertiary">{lead.customer.email}</p> : null}
              <p className="text-xs text-ink-tertiary">Customer since {formatDate(lead.customer.createdAt)}</p>
            </div>

            <div className="border-b border-hairline py-3">
              <p className="mb-1.5 text-xs font-medium text-ink-tertiary uppercase">All Passengers</p>
              {lead.customer.passengers.length === 0 ? (
                <p className="text-xs text-ink-tertiary">None yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {lead.customer.passengers.map((passenger) => (
                    <li key={passenger.id} className="text-sm text-ink-secondary">
                      {passenger.fullName}{" "}
                      <span className="text-xs text-ink-tertiary">({PAX_TYPE_LABELS[passenger.paxType]})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="py-3">
              <p className="mb-1.5 text-xs font-medium text-ink-tertiary uppercase">Other Requests</p>
              {lead.customer.otherLeads.length === 0 && lead.customer.otherBookings.length === 0 ? (
                <p className="text-xs text-ink-tertiary">No other services yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {lead.customer.otherLeads.map((otherLead) => (
                    <li key={otherLead.id}>
                      <Link href={`/crm/leads/${otherLead.id}`} className="text-sm text-ink-accent hover:underline">
                        {otherLead.referenceId}
                      </Link>{" "}
                      <span className="inline-flex items-center gap-1 text-xs text-ink-tertiary">
                        {SERVICE_TYPE_LABELS[otherLead.serviceType]} · <LeadStatusBadge status={otherLead.status} />
                      </span>
                    </li>
                  ))}
                  {lead.customer.otherBookings.map((booking) => (
                    <li key={booking.id}>
                      <Link href={`/crm/bookings/${booking.id}`} className="text-sm text-ink-accent hover:underline">
                        {booking.bookingId}
                      </Link>{" "}
                      <span className="inline-flex items-center gap-1 text-xs text-ink-tertiary">
                        <BookingStatusBadge status={booking.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Activity Timeline</h2>
            <LeadTimeline entries={lead.timeline} />
          </section>
        </div>
      </div>
    </div>
  );
}
