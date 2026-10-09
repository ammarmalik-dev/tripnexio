"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { RecordHeader, RecordSection, RecordTabs } from "./detail/RecordDetail";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { BookingStatusControl } from "./BookingStatusControl";
import { CopyPaymentLinkButton } from "./CopyPaymentLinkButton";
import { BookingPassengerStatusControl } from "./BookingPassengerStatusControl";
import { ExtensionOutcomeControl } from "./ExtensionOutcomeControl";
import { PaymentPanel, type PaymentData } from "./PaymentPanel";
import { DocumentStatusControl } from "./DocumentStatusControl";
import { DocumentExtractionReview } from "./DocumentExtractionReview";
import { AddDocumentForm } from "./AddDocumentForm";
import { DeliverOutputSection } from "./DeliverOutputSection";
import { DocumentFileLinks } from "./DocumentFileLinks";
import { DocumentUploadButton } from "./DocumentUploadButton";
import { PurgedFileTag } from "./PurgedFileTag";
import { ApplicantsTable } from "./ApplicantsTable";
import { EmbassyActionsPanel } from "./EmbassyActionsPanel";
import { VisaChangeActionsPanel, type VisaChangeBookingView } from "./VisaChangeActionsPanel";
import { SpecialFareActionsPanel, type SpecialFareBookingView } from "./SpecialFareActionsPanel";
import { ReturnTicketActionsPanel, type ReturnTicketBookingView } from "./ReturnTicketActionsPanel";
import { LinkedBookingPanel, type LinkedBookingView } from "./LinkedBookingPanel";
import { OtbActionsPanel, type OtbBookingView } from "./OtbActionsPanel";
import { DEFAULT_OUTPUT_BY_SERVICE, OUTPUTS_BY_SERVICE } from "@/lib/outputs/output-types";
import { RequestDocumentForm } from "./RequestDocumentForm";
import type { ApplicantRow } from "@/lib/new-visa/applicants";
import { ProtectionPlanControl, type ProtectionPlanData } from "./ProtectionPlanControl";
import { ReusableDocumentsPrompt } from "./ReusableDocumentsPrompt";
import { CommunicationsPanel } from "./CommunicationsPanel";
import { AddTaskPanel } from "./tasks/CreateTaskForm";
import { BookingDatesRow } from "./booking/BookingDatesRow";
import { BookingVendorSummary, type BookingVendorSummaryData } from "./booking/BookingVendorSummary";
import { BookingTimelineSection, type BookingTimelineEntry } from "./booking/BookingTimelineSection";
import type { BookingDateItem } from "@/lib/crm/booking-dates";
import { SERVICE_TYPE_LABELS, PROTECTION_PLAN_STATUS_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { cn } from "@/lib/cn";
import type { BookingStatus, DocumentStatus, ExtensionOutcome, PaxType, ProtectionPlanStatus, ServiceType } from "../../generated/prisma/enums";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

interface DocumentItem {
  id: string;
  type: string;
  status: DocumentStatus;
  rejectionReason?: string | null;
  fileUrl: string | null;
  /** P27 - set when the retention job deleted the file. */
  purgedAt?: string | null;
  createdAt: string;
  passengerId: string | null;
  /** P09 — set on documents delivered to the customer (visa, ticket, package...). */
  deliveredAt?: string | null;
}

interface BookingPassengerItem {
  id: string;
  fullName: string;
  paxType: PaxType;
  /** Independently settable from the booking-level status above — CRM.md §12 (Step 14). */
  status: BookingStatus;
}

/** Step 23 (audit §7.6) — frozen at booking creation, never re-fetched live. */
interface DocumentChecklistSnapshotPassenger {
  passengerId: string;
  fullName: string;
  nationality: string | null;
  requirements: { documentName: string; required: boolean }[];
}

interface DocumentChecklistSnapshot {
  generatedAt: string;
  serviceType: ServiceType;
  passengers: DocumentChecklistSnapshotPassenger[];
}

interface BookingDetailResponse {
  id: string;
  bookingId: string;
  customerToken: string | null;
  status: BookingStatus;
  /** Visa Extension only — Visa_Extension.md §17-18 (Step 15). */
  extensionOutcome: ExtensionOutcome | null;
  createdAt: string;
  leadId: string;
  leadReferenceId: string;
  poc: { name: string; active: boolean } | null;
  paxCount: number;
  subService: string | null;
  countryName: string | null;
  /** Client corrections 2026-10-05 — bank transfer only for leads created by staff. */
  offlinePaymentAllowed: boolean;
  serviceType: ServiceType;
  selectedQuotation: { id: string; sellingPrice: string; margin: string; cancellationCharge?: string | null } | null;
  customer: {
    id: string;
    name: string;
    mobile: string;
    email: string | null;
    passengers: { id: string; fullName: string; paxType: PaxType }[];
  };
  /** This booking's own passengers, each with an independent status and their own documents — distinct from customer.passengers (full Customer-360 history). */
  passengers: BookingPassengerItem[];
  payments: PaymentData[];
  documents: DocumentItem[];
  /** New Visa only (Step 20, audit §7.1) — one per passenger, empty array for every other service. */
  protectionPlans: ProtectionPlanData[];
  /** Step 23 (audit §7.6) — null for a booking created before this field existed. */
  documentChecklistSnapshot: DocumentChecklistSnapshot | null;
  /** P11 — dates staff need side by side, the embassy outcome, and every applicant. */
  appliedToEmbassyAt: string | null;
  visaRejectionReason: string | null;
  travelDate: string | null;
  serviceStatusName: string | null;
  applicants: ApplicantRow[];
  /** P13 — Visa Extension: the New Visa booking it extends; a New Visa booking: its extensions. */
  originalBooking: { id: string; bookingId: string; status: BookingStatus } | null;
  /** P14 — Visa Change only. */
  visaChange: VisaChangeBookingView | null;
  /** P16 — Special Fare only. */
  specialFare: SpecialFareBookingView | null;
  /** P17 — Return Ticket only. */
  returnTicket: ReturnTicketBookingView | null;
  /** P18 — OTB only. */
  otb: OtbBookingView | null;
  /** P17 — OTB <-> Return Ticket pair (CRM.md §15). */
  linkedBooking: LinkedBookingView | null;
  reservationIssuedAt: string | null;
  reservationExpiresAt: string | null;
  reservationExpired: boolean;
  extensions: { id: string; bookingId: string; status: BookingStatus; createdAt: string }[];
  /** P12 — New Visa only: per passenger, Visa status and Protection Plan status side by side. */
  passengerStatuses: { passengerId: string; fullName: string; visaStatus: string; protectionPlanStatus: ProtectionPlanStatus | null }[];
  /** P21 — CRM.md §12 service-specific labelled dates. */
  bookingDates: BookingDateItem[];
  /** P21 — staff-internal vendor / cost / margin / reference / PNR summary. */
  vendorSummary: BookingVendorSummaryData | null;
  /** P21 — CRM.md §36, oldest first, capped server-side. */
  timeline: BookingTimelineEntry[];
  timelineTruncated: boolean;
}

type FetchState = "loading" | "success" | "error";

function formatShortDate(value: string): string {
  // A bare YYYY-MM-DD is a calendar date, so format it in UTC to never shift a day.
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(/^\d{4}-\d{2}-\d{2}$/.test(value) ? { timeZone: "UTC" } : {}),
  });
}

/** Step 16 (audit §3.6) — same type-name convention /api/documents/[id]/upload already auto-triggers OCR on. */
function extractionTypeForDocument(type: string): "TICKET" | "VISA" | null {
  if (/ticket/i.test(type)) return "TICKET";
  if (/visa/i.test(type)) return "VISA";
  return null;
}

export function BookingDetail({
  bookingId,
  canApproveRefunds,
  canApproveBankTransfer,
  basePath = "/crm/bookings",
}: {
  bookingId: string;
  /** "/admin/bookings" when opened from Admin, so links keep the Admin context (client corrections 2026-10-05). */
  basePath?: string;
  canApproveRefunds: boolean;
  canApproveBankTransfer: boolean;
}) {
  const [state, setState] = useState<FetchState>("loading");
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [showExtraPaymentForm, setShowExtraPaymentForm] = useState(false);
  const [extraAmount, setExtraAmount] = useState("");
  const [extraDescription, setExtraDescription] = useState("");
  const [creatingExtraPayment, setCreatingExtraPayment] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  useEffect(() => {
    let cancelled = false;

    async function loadBooking() {
      setState("loading");
      try {
        const result = await getJson<BookingDetailResponse>(`/api/bookings/${bookingId}`);
        if (cancelled) return;
        setBooking(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this booking. Please try again.");
        setState("error");
      }
    }

    void loadBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingId, reloadNonce]);

  const handleCreatePayment = async (method: "gateway" | "bank-transfer") => {
    setCreatingPayment(true);
    try {
      const path = method === "gateway" ? `/api/bookings/${bookingId}/payments` : `/api/bookings/${bookingId}/bank-transfer-payment`;
      await postJson(path, {});
      toast.success(method === "gateway" ? "Payment link created." : "Bank-transfer payment created.");
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create a payment. Please try again.");
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleCreateExtraPayment = async () => {
    const amount = Number(extraAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!extraDescription.trim()) {
      toast.error("Enter a reason for this extra payment.");
      return;
    }
    const reason = await confirm({
      title: `Raise an extra payment of ₹${amount.toLocaleString("en-IN")}?`,
      description: `A new payment link is raised for the customer on top of what they have already paid. Description shown to the customer: "${extraDescription.trim()}"`,
      confirmLabel: "Raise Extra Payment",
    });
    if (!reason) return;
    setCreatingExtraPayment(true);
    try {
      await postJson(`/api/bookings/${bookingId}/extra-payments`, { amount, description: extraDescription.trim(), reason });
      toast.success("Extra payment link created.");
      setShowExtraPaymentForm(false);
      setExtraAmount("");
      setExtraDescription("");
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create the extra payment. Please try again.");
    } finally {
      setCreatingExtraPayment(false);
    }
  };

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
        title="Couldn't load this booking"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!booking) return null;

  const hasPendingPayment = booking.payments.some((payment) => payment.status === "PENDING");
  const missingDocuments = booking.documents.filter((document) => document.status === "MISSING");

  const refresh = () => setReloadNonce((current) => current + 1);
  const latestPayment = booking.payments[0] ?? null;
  const generalDocuments = booking.documents.filter((document) => !document.passengerId);
  const updateDocument = (documentId: string, status: DocumentStatus, rejectionReason?: string | null) =>
    setBooking((current) =>
      current ? { ...current, documents: current.documents.map((doc) => (doc.id === documentId ? { ...doc, status, rejectionReason } : doc)) } : current
    );

  const renderDocument = (document: DocumentItem) => {
    const extractionType = extractionTypeForDocument(document.type);
    return (
      <div key={document.id} className="rounded-md border border-hairline bg-surface-1 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2 text-ink-primary">
            {document.type}
            <PurgedFileTag purgedAt={document.purgedAt} />
            <DocumentFileLinks fileUrl={document.fileUrl} purgedAt={document.purgedAt} />
            {!document.purgedAt ? <DocumentUploadButton documentId={document.id} hasFile={Boolean(document.fileUrl)} onUploaded={refresh} /> : null}
          </span>
          <DocumentStatusControl
            documentId={document.id}
            status={document.status}
            rejectionReason={document.rejectionReason}
            onChanged={(status, rejectionReason) => updateDocument(document.id, status, rejectionReason)}
          />
        </div>
        {extractionType ? (
          <DocumentExtractionReview documentId={document.id} documentType={extractionType} hasFile={Boolean(document.fileUrl)} onUploaded={refresh} />
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <RecordHeader
        backHref={basePath}
        backLabel="Back to Bookings"
        eyebrow={
          <>
            <span>{SERVICE_TYPE_LABELS[booking.serviceType]}</span>
            <span>
              Lead{" "}
              <Link href={`/crm/leads/${booking.leadId}`} className="text-ink-accent hover:underline">
                {booking.leadReferenceId}
              </Link>
            </span>
          </>
        }
        title={booking.bookingId}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-ink-secondary">{booking.customer.name}</span>
            <span>{booking.customer.mobile}</span>
            {booking.customer.email ? <span>{booking.customer.email}</span> : null}
          </span>
        }
        facts={[
          {
            label: "Service",
            value: booking.subService ? `${SERVICE_TYPE_LABELS[booking.serviceType]} · ${booking.subService}` : SERVICE_TYPE_LABELS[booking.serviceType],
          },
          { label: "PAX", value: booking.paxCount },
          { label: "Country", value: booking.countryName ?? "—" },
          { label: "Booking date", value: formatShortDate(booking.createdAt) },
          { label: "Travel date", value: booking.travelDate ? formatShortDate(booking.travelDate) : "—" },
          { label: "Payment", value: latestPayment ? <PaymentStatusBadge status={latestPayment.status} /> : <span className="text-ink-tertiary">No payment</span> },
        ]}
        status={
          <div className="flex flex-col items-end gap-2">
            <BookingStatusControl
              bookingId={booking.id}
              status={booking.status}
              onChanged={(status) => setBooking((current) => (current ? { ...current, status } : current))}
            />
            {booking.serviceType === "VISA_EXTENSION" ? (
              <ExtensionOutcomeControl
                bookingId={booking.id}
                outcome={booking.extensionOutcome}
                // A full reload (not a local patch) — this also changes which
                // refund rule applies to every payment, and that's only
                // ever computed server-side (GET /api/bookings/[id]).
                onChanged={refresh}
              />
            ) : null}
          </div>
        }
        controls={
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wide text-ink-tertiary uppercase">POC</span>
            <span className="text-sm font-medium text-ink-primary">
              {booking.poc ? (booking.poc.active ? booking.poc.name : `Unassigned (was ${booking.poc.name})`) : "Unassigned"}
            </span>
          </div>
        }
        actions={<CopyPaymentLinkButton customerToken={booking.customerToken} />}
      />

      {missingDocuments.length > 0 ? (
        <div role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Additional documents required: {missingDocuments.length} document{missingDocuments.length === 1 ? "" : "s"} waiting for the customer.
        </div>
      ) : null}

      <RecordTabs
        label="Booking sections"
        tabs={[
          {
            id: "operations",
            label: "Operations",
            content: (
              <div className="flex flex-col gap-5">
                {booking.bookingDates.length > 0 || booking.originalBooking || booking.extensions.length > 0 || booking.serviceType === "VISA_EXTENSION" ? (
                  <RecordSection title="Key dates & links">
                    <BookingDatesRow items={booking.bookingDates} />
                    {booking.originalBooking ? (
                      <p className="mt-3 text-xs text-ink-secondary">
                        Extends original New Visa booking{" "}
                        <Link href={`${basePath}/${booking.originalBooking.id}`} className="font-medium text-ink-accent hover:underline">
                          {booking.originalBooking.bookingId}
                        </Link>
                      </p>
                    ) : booking.serviceType === "VISA_EXTENSION" ? (
                      <p className="mt-3 text-xs text-warning">No original TripNexio New Visa booking matched this extension&apos;s passports.</p>
                    ) : null}
                    {booking.extensions.length > 0 ? (
                      <p className="mt-3 text-xs text-ink-secondary">
                        Extensions:{" "}
                        {booking.extensions.map((extension, index) => (
                          <span key={extension.id}>
                            {index > 0 ? ", " : ""}
                            <Link href={`${basePath}/${extension.id}`} className="font-medium text-ink-accent hover:underline">
                              {extension.bookingId}
                            </Link>
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </RecordSection>
                ) : null}

                {booking.serviceType === "NEW_VISA" ? (
                  <EmbassyActionsPanel
                    bookingId={booking.id}
                    bookingDate={booking.createdAt}
                    appliedToEmbassyAt={booking.appliedToEmbassyAt}
                    travelDate={booking.travelDate}
                    currentStatus={booking.serviceStatusName}
                    rejectionReason={booking.visaRejectionReason}
                    onChanged={refresh}
                  />
                ) : null}

                {booking.serviceType === "RETURN_TICKET" && booking.returnTicket ? (
                  <ReturnTicketActionsPanel
                    bookingId={booking.id}
                    view={booking.returnTicket}
                    reservationIssuedAt={booking.reservationIssuedAt}
                    reservationExpiresAt={booking.reservationExpiresAt}
                    reservationExpired={booking.reservationExpired}
                    onChanged={refresh}
                  />
                ) : null}

                {booking.serviceType === "OTB" && booking.otb ? (
                  <OtbActionsPanel bookingId={booking.id} view={booking.otb} currentStatus={booking.serviceStatusName} onChanged={refresh} />
                ) : null}

                {booking.serviceType === "RETURN_TICKET" || booking.serviceType === "OTB" ? (
                  <LinkedBookingPanel bookingId={booking.id} serviceType={booking.serviceType} linked={booking.linkedBooking} onChanged={refresh} />
                ) : null}

                {booking.serviceType === "FLIGHT_SPECIAL_FARE" && booking.specialFare ? (
                  <SpecialFareActionsPanel bookingId={booking.id} view={booking.specialFare} currentStatus={booking.serviceStatusName} onChanged={refresh} />
                ) : null}

                {booking.serviceType === "VISA_CHANGE" && booking.visaChange ? (
                  <VisaChangeActionsPanel
                    bookingId={booking.id}
                    view={booking.visaChange}
                    currentStatus={booking.serviceStatusName}
                    rejectionReason={booking.visaRejectionReason}
                    onChanged={refresh}
                  />
                ) : null}

                {booking.passengerStatuses.length > 0 ? (
                  <RecordSection title="Visa & Protection Plan by passenger">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-hairline text-xs text-ink-tertiary">
                            <th scope="col" className="py-2 pr-3 font-medium">Passenger</th>
                            <th scope="col" className="py-2 pr-3 font-medium">Visa status</th>
                            <th scope="col" className="py-2 font-medium">Protection Plan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {booking.passengerStatuses.map((row) => (
                            <tr key={row.passengerId} className="border-b border-hairline last:border-b-0">
                              <td className="py-2 pr-3 text-ink-primary">{row.fullName}</td>
                              <td className="py-2 pr-3 text-ink-secondary">{row.visaStatus}</td>
                              <td className="py-2 text-ink-secondary">
                                {row.protectionPlanStatus ? PROTECTION_PLAN_STATUS_LABELS[row.protectionPlanStatus] : "Not offered"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </RecordSection>
                ) : null}

                <DeliverOutputSection
                  bookingId={booking.id}
                  passengers={booking.passengers}
                  documents={booking.documents}
                  onDelivered={refresh}
                  defaultOutputType={DEFAULT_OUTPUT_BY_SERVICE[booking.serviceType]}
                  allowedOutputTypes={OUTPUTS_BY_SERVICE[booking.serviceType]}
                />
              </div>
            ),
          },
          {
            id: "payments",
            label: "Payments",
            count: booking.payments.length,
            content: (
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
                <RecordSection
                  title="Payments"
                  className="xl:col-span-2"
                  action={
                    <div className="flex flex-wrap gap-2">
                      {booking.status === "PENDING" && !hasPendingPayment ? (
                        <>
                          <Button type="button" size="sm" variant="ghost" onClick={() => void handleCreatePayment("gateway")} isLoading={creatingPayment}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Payment Link
                          </Button>
                          {booking.offlinePaymentAllowed ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => void handleCreatePayment("bank-transfer")} isLoading={creatingPayment}>
                              <Plus className="h-4 w-4" aria-hidden="true" />
                              Bank Transfer
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {/* Step 52 — Extra Payment Collection: only once the booking has a real, active lifecycle (not still awaiting its primary payment, and not dead), and no other payment is already pending. */}
                      {!["PENDING", "CANCELLED", "REFUNDED"].includes(booking.status) && !hasPendingPayment && !showExtraPaymentForm ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setShowExtraPaymentForm(true)}>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Extra Payment
                        </Button>
                      ) : null}
                    </div>
                  }
                >
                  {showExtraPaymentForm ? (
                    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr]">
                        <input
                          type="number"
                          min={1}
                          placeholder="Amount"
                          aria-label="Extra payment amount"
                          value={extraAmount}
                          onChange={(event) => setExtraAmount(event.target.value)}
                          className={cn(fieldControlClass, fieldBorderClass(false))}
                        />
                        <input
                          type="text"
                          placeholder="Reason (e.g. Additional baggage fee)"
                          aria-label="Extra payment reason"
                          value={extraDescription}
                          onChange={(event) => setExtraDescription(event.target.value)}
                          className={cn(fieldControlClass, fieldBorderClass(false))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => void handleCreateExtraPayment()} isLoading={creatingExtraPayment}>
                          Create Extra Payment
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setShowExtraPaymentForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {booking.payments.length === 0 ? (
                    <EmptyState title="No payments yet" description="Create a payment once this booking is ready to be charged." />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {booking.payments.map((payment) => (
                        <PaymentPanel
                          key={payment.id}
                          payment={payment}
                          passengers={booking.passengers}
                          onChanged={refresh}
                          canApproveRefunds={canApproveRefunds}
                          canApproveBankTransfer={canApproveBankTransfer}
                          defaultCancellationCharge={
                            booking.selectedQuotation?.cancellationCharge != null ? Number(booking.selectedQuotation.cancellationCharge) : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                </RecordSection>
                <RecordSection title="Vendor">
                  {booking.vendorSummary ? (
                    <BookingVendorSummary vendor={booking.vendorSummary} compact={booking.serviceType === "RETURN_TICKET"} />
                  ) : (
                    <p className="text-sm text-ink-tertiary">No selected quotation, so no vendor on record.</p>
                  )}
                </RecordSection>
              </div>
            ),
          },
          {
            id: "documents",
            label: "Documents & PAX",
            count: booking.documents.length,
            content: (
              <div className="flex flex-col gap-5">
                <RecordSection title="Applicants">
                  <ApplicantsTable applicants={booking.applicants} />
                </RecordSection>

                <RecordSection
                  title={
                    <span className="flex flex-col">
                      Booking Documents
                      <span className="text-xs font-normal text-ink-tertiary">All travellers&rsquo; documents for this booking, each traveller with its own status.</span>
                    </span>
                  }
                  action={
                    booking.documents.some((document) => document.fileUrl && !document.purgedAt) ? (
                      <a
                        href={`/api/bookings/${booking.id}/documents-zip`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink-accent hover:bg-ink-primary/[0.03]"
                      >
                        Download all (ZIP)
                      </a>
                    ) : null
                  }
                >
                  <div className="mb-4">
                    <AddDocumentForm bookingId={booking.id} passengers={booking.passengers} onAdded={refresh} />
                    <div className="mt-2">
                      <RequestDocumentForm bookingId={booking.id} passengers={booking.passengers} onRequested={refresh} />
                    </div>
                  </div>
                  {booking.passengers.length === 0 ? (
                    <p className="text-sm text-ink-tertiary">No passengers linked to this booking.</p>
                  ) : (
                    <div className={cn("grid grid-cols-1 gap-4", booking.passengers.length > 1 && "xl:grid-cols-2")}>
                      {booking.passengers.map((passenger) => {
                        const passengerDocuments = booking.documents.filter((document) => document.passengerId === passenger.id);
                        const protectionPlan = booking.protectionPlans.find((plan) => plan.passengerId === passenger.id);
                        const checklist = booking.documentChecklistSnapshot?.passengers.find((p) => p.passengerId === passenger.id);
                        return (
                          <div key={passenger.id} className="rounded-lg border border-hairline bg-surface-1/70 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-ink-primary">{passenger.fullName}</p>
                              <BookingPassengerStatusControl
                                bookingId={booking.id}
                                passengerId={passenger.id}
                                status={passenger.status}
                                onChanged={(status) =>
                                  setBooking((current) =>
                                    current ? { ...current, passengers: current.passengers.map((p) => (p.id === passenger.id ? { ...p, status } : p)) } : current
                                  )
                                }
                              />
                            </div>
                            {checklist && checklist.requirements.length > 0 ? (
                              <div className="mt-2 border-t border-hairline pt-2">
                                <p className="text-xs font-medium text-ink-tertiary">
                                  Required documents (as of booking creation{checklist.nationality ? ` — ${checklist.nationality}` : ""})
                                </p>
                                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                  {checklist.requirements.map((item) => (
                                    <li key={item.documentName} className="text-xs text-ink-secondary">
                                      {item.documentName}
                                      {!item.required ? <span className="text-ink-tertiary"> (optional)</span> : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {protectionPlan ? (
                              <div className="mt-2 border-t border-hairline pt-2">
                                <ProtectionPlanControl plan={protectionPlan} canDecideRefund={canApproveRefunds} onChanged={refresh} />
                              </div>
                            ) : null}
                            <ReusableDocumentsPrompt passengerId={passenger.id} bookingId={booking.id} onReused={refresh} />
                            <div className="mt-2 flex flex-col gap-2">
                              {passengerDocuments.length === 0 ? (
                                <p className="text-xs text-ink-tertiary">No documents for this passenger yet.</p>
                              ) : (
                                passengerDocuments.map(renderDocument)
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </RecordSection>

                {generalDocuments.length > 0 ? (
                  <RecordSection title="General Documents">
                    <p className="mb-3 text-xs text-ink-tertiary">Not tied to a specific passenger.</p>
                    <div className="flex flex-col gap-2">{generalDocuments.map(renderDocument)}</div>
                  </RecordSection>
                ) : null}
              </div>
            ),
          },
          {
            id: "communication",
            label: "Communication & Tasks",
            content: (
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
                <RecordSection title="Communications" className="xl:col-span-2">
                  <CommunicationsPanel leadId={booking.leadId} />
                </RecordSection>
                <AddTaskPanel bookingId={booking.id} />
              </div>
            ),
          },
          {
            id: "timeline",
            label: "Timeline",
            count: booking.timeline.length,
            content: <BookingTimelineSection entries={booking.timeline} truncated={booking.timelineTruncated} />,
          },
        ]}
      />
      {dialog}
    </div>
  );
}
