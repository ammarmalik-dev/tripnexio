"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PurgedFileTag } from "./PurgedFileTag";
import { DocumentFileLinks } from "./DocumentFileLinks";
import { DocumentUploadButton } from "./DocumentUploadButton";
import { AddDocumentForm } from "./AddDocumentForm";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { LeadStatusControl } from "./LeadStatusControl";
import { LeadAssignmentControl } from "./LeadAssignmentControl";
import { LeadTemperatureControl } from "./LeadTemperatureControl";
import { LeadServiceTypeControl } from "./LeadServiceTypeControl";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { ListPagination } from "./ListPagination";
import { useClientPagination } from "./usePagination";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { PassportExtractionReview } from "./PassportExtractionReview";
import { VisaExtensionEligibilityPanel } from "./VisaExtensionEligibilityPanel";
import { VisaChangeBorderDetailsPanel } from "./VisaChangeBorderDetailsPanel";
import { LeadTimeline } from "./LeadTimeline";
import { CommunicationsPanel } from "./CommunicationsPanel";
import { QuoteBuilder } from "./QuoteBuilder";
import { AddTaskPanel } from "./tasks/CreateTaskForm";
import { SERVICE_TYPE_LABELS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { humanizeKey, formatDetailValue } from "@/lib/crm/humanize";
import { useProcessingTypes } from "@/lib/processing-types/use-processing-types";
import { VisaExtensionPriorVisaPanel, type PriorVisaMatchItem } from "./VisaExtensionPriorVisaPanel";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import type { ServiceType, LeadStatus, LeadTemperature, BookingStatus, PaymentStatus, PaxType, DocumentStatus } from "../../generated/prisma/enums";
import { ApplicantsTable } from "./ApplicantsTable";
import type { ApplicantRow } from "@/lib/new-visa/applicants";
import { urgentDeadlineFromDetails } from "@/lib/visa-extension/rules";
import { VisaChangeA2ADetailsPanel } from "./VisaChangeA2ADetailsPanel";

/**
 * Client-side pagination for a lead-detail list that can grow without bound
 * (the customer's other requests, all their passengers, the timeline): the
 * first 10 entries, plus a pager once there is more than one default page.
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
  /** P27 - set when the retention job deleted the file. */
  purgedAt?: string | null;
}

interface LeadPassenger {
  id: string;
  fullName: string;
  paxType: PaxType;
  nationality: string | null;
  passportNumber: string | null;
  documents: PassengerDocument[];
}

interface LeadDetailResponse {
  id: string;
  referenceId: string;
  /** P11 — every applicant: passport, DOB, occupation, passenger type, guardian. */
  applicants: ApplicantRow[];
  serviceType: ServiceType;
  status: LeadStatus;
  temperature: LeadTemperature | null;
  source: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  assignedStaff: { id: string; name: string; email: string; active: boolean } | null;
  customer: {
    id: string;
    name: string;
    mobile: string;
    email: string | null;
    createdAt: string;
  };
  passengers: LeadPassenger[];
  priorVisaMatches: PriorVisaMatchItem[];
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

export function LeadDetail({
  leadId,
  canReassignLeads,
  currentStaffId,
}: {
  leadId: string;
  canReassignLeads: boolean;
  currentStaffId: string;
}) {
  const [state, setState] = useState<FetchState>("loading");
  const [lead, setLead] = useState<LeadDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [creatingBooking, setCreatingBooking] = useState(false);
  // P23 — processing-type labels from the Admin master for this lead's service.
  const { options: processingTypeOptions } = useProcessingTypes(lead?.serviceType);

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

  const INTERNAL_DETAIL_KEYS = new Set([
    "passengerIds",
    "visaTypeId",
    "newVisaConfigId",
    "verifiedExpiryDate",
    "eligibilityOutcome",
    "verifiedByStaffId",
    "verifiedAt",
    "urgentDeadline",
    "noPriorVisa",
    "noPriorVisaApplicants",
    "passengerReuse",
    "newQuoteRequestedAt",
    "borderOperationalDetails",
    "a2aOperationalDetails",
    "passengers",
    "applicants",
  ]);
  // (New Visa/Visa Extension/Return Ticket store an applicant-wise list under details.applicants.)
  const detailEntries = Object.entries(lead.details).filter(([key]) => !INTERNAL_DETAIL_KEYS.has(key));
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">
              {SERVICE_TYPE_LABELS[lead.serviceType]} · {lead.referenceId}
            </p>
            {lead.quotations.length === 0 && lead.bookings.length === 0 ? (
              <LeadServiceTypeControl leadId={lead.id} serviceType={lead.serviceType} onChanged={() => setReloadNonce((current) => current + 1)} />
            ) : null}
          </div>
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
            serviceType={lead.serviceType}
            assignedStaff={lead.assignedStaff}
            canReassign={canReassignLeads}
            currentStaffId={currentStaffId}
            onChanged={(assignedStaff) =>
              setLead((current) =>
                current
                  ? { ...current, assignedStaff: assignedStaff ? { ...assignedStaff, email: "" } : null }
                  : current
              )
            }
          />
          <LeadTemperatureControl
            leadId={lead.id}
            temperature={lead.temperature}
            onChanged={(temperature) => setLead((current) => (current ? { ...current, temperature } : current))}
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
                    <dd className="text-sm font-medium text-ink-primary">{formatDetailValue(lead.serviceType, key, value, processingTypeOptions)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {lead.serviceType === "FLIGHT_SPECIAL_FARE" && typeof lead.details.newQuoteRequestedAt === "string" ? (
            <div role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <span className="font-semibold">New quote requested</span> by the customer on{" "}
              {new Date(lead.details.newQuoteRequestedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
              after the Special Fare quotation expired. Reconfirm availability, then revalidate the quote or build a new one.
            </div>
          ) : null}

          {Array.isArray(lead.details.passengerReuse) && lead.details.passengerReuse.length > 0 ? (
            <div className="rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-sm">
              <p className="mb-1 font-semibold text-ink-heading">Returning passengers</p>
              <ul className="flex flex-col gap-0.5 text-ink-secondary">
                {(lead.details.passengerReuse as { fullName?: string; reusePassport?: string | null }[]).map((row, index) => (
                  <li key={index}>
                    {row.fullName ?? "Passenger"} — reuse passport details:{" "}
                    {row.reusePassport === "yes" ? "Yes" : row.reusePassport === "no" ? "No (updated passport needed)" : "—"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {lead.serviceType === "VISA_EXTENSION" && lead.details.noPriorVisa === true ? (
            <div role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <span className="font-semibold">No prior TripNexio visa</span>
              {Array.isArray(lead.details.noPriorVisaApplicants) && lead.details.noPriorVisaApplicants.length > 0
                ? ` for ${(lead.details.noPriorVisaApplicants as unknown[]).filter((name): name is string => typeof name === "string").join(", ")}`
                : ""}
              . The customer was shown the Visa Change (inside the UAE) / New Visa (outside the UAE) options.
            </div>
          ) : null}

          {lead.serviceType === "VISA_EXTENSION" ? (
            <VisaExtensionPriorVisaPanel
              items={lead.priorVisaMatches}
              visaExpiryByPassport={Object.fromEntries(
                (Array.isArray(lead.details.applicants) ? (lead.details.applicants as { passportNumber?: string; visaExpiryDate?: string }[]) : [])
                  .filter((a) => a.passportNumber && a.visaExpiryDate)
                  .map((a) => [a.passportNumber as string, a.visaExpiryDate as string])
              )}
            />
          ) : null}

          {lead.serviceType === "VISA_EXTENSION" ? (
            <VisaExtensionEligibilityPanel
              leadId={lead.id}
              verifiedExpiryDate={typeof lead.details.verifiedExpiryDate === "string" ? lead.details.verifiedExpiryDate : undefined}
              eligibilityOutcome={
                lead.details.eligibilityOutcome === "ELIGIBLE" ||
                lead.details.eligibilityOutcome === "URGENT_TODAY" ||
                lead.details.eligibilityOutcome === "NOT_ELIGIBLE"
                  ? lead.details.eligibilityOutcome
                  : undefined
              }
              urgentDeadline={urgentDeadlineFromDetails(lead.details)}
              onVerified={(result) =>
                setLead((current) =>
                  current
                    ? {
                        ...current,
                        details: {
                          ...current.details,
                          verifiedExpiryDate: result.verifiedExpiryDate,
                          eligibilityOutcome: result.outcome,
                          urgentDeadline: result.urgentDeadline ?? undefined,
                        },
                      }
                    : current
                )
              }
            />
          ) : null}

          {lead.serviceType === "VISA_CHANGE" && lead.details.changeType === "BORDER_EXIT" ? (
            <VisaChangeBorderDetailsPanel
              leadId={lead.id}
              existing={
                lead.details.borderOperationalDetails && typeof lead.details.borderOperationalDetails === "object"
                  ? (lead.details.borderOperationalDetails as Record<string, unknown>)
                  : undefined
              }
              onSaved={(details) =>
                setLead((current) =>
                  current ? { ...current, details: { ...current.details, borderOperationalDetails: details } } : current
                )
              }
            />
          ) : null}

          {lead.serviceType === "VISA_CHANGE" && lead.details.changeType === "AIRPORT_TO_AIRPORT" ? (
            <VisaChangeA2ADetailsPanel
              leadId={lead.id}
              existing={
                lead.details.a2aOperationalDetails && typeof lead.details.a2aOperationalDetails === "object"
                  ? (lead.details.a2aOperationalDetails as Record<string, unknown>)
                  : undefined
              }
              onSaved={(details) =>
                setLead((current) => (current ? { ...current, details: { ...current.details, a2aOperationalDetails: details } } : current))
              }
            />
          ) : null}

          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Applicants</h2>
            <ApplicantsTable applicants={lead.applicants} />
          </section>

          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Passengers &amp; Documents</h2>
            {lead.passengers.length > 0 ? (
              <div className="mb-4">
                <AddDocumentForm passengers={lead.passengers} onAdded={() => setReloadNonce((current) => current + 1)} />
              </div>
            ) : null}
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
                        {passenger.passportNumber ? ` · ${passenger.passportNumber}` : ""}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {passenger.documents.length === 0 ? (
                        <span className="text-xs text-ink-tertiary">No documents yet.</span>
                      ) : (
                        passenger.documents.map((document) => (
                          <div key={document.id} className="flex items-center gap-1.5">
                            <span className="flex flex-wrap items-center gap-2 text-xs text-ink-tertiary">
                              {document.type}
                              <PurgedFileTag purgedAt={document.purgedAt} />
                              <DocumentFileLinks fileUrl={document.fileUrl} purgedAt={document.purgedAt} />
                            </span>
                            <DocumentStatusBadge status={document.status} />
                            {!document.purgedAt ? (
                              <DocumentUploadButton documentId={document.id} hasFile={Boolean(document.fileUrl)} onUploaded={() => setReloadNonce((current) => current + 1)} />
                            ) : null}
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
                              <PaymentStatusBadge status={payment.status} />
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

          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Communications</h2>
            <CommunicationsPanel leadId={lead.id} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {/* Client corrections 2026-10-05: a Lead shows only its own records; the
              customer's other leads/bookings live in the separate Customer 360 page. */}
          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Customer</h2>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-ink-primary">{lead.customer.name}</p>
              <p className="text-xs text-ink-tertiary">{lead.customer.mobile}</p>
              {lead.customer.email ? <p className="text-xs text-ink-tertiary">{lead.customer.email}</p> : null}
              <p className="text-xs text-ink-tertiary">Customer since {formatDate(lead.customer.createdAt)}</p>
            </div>
            <Link href={`/crm/customers/${lead.customer.id}`} className="mt-3 inline-flex text-sm font-medium text-ink-accent hover:underline">
              Open Customer 360
            </Link>
          </section>

          <AddTaskPanel leadId={lead.id} />

          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Activity Timeline</h2>
            <Paged items={lead.timeline} noun="timeline event">
              {(rows) => <LeadTimeline entries={rows} />}
            </Paged>
          </section>
        </div>
      </div>
    </div>
  );
}
