"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
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
import { ProtectionPlanControl, type ProtectionPlanData } from "./ProtectionPlanControl";
import { ReusableDocumentsPrompt } from "./ReusableDocumentsPrompt";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { cn } from "@/lib/cn";
import type { BookingStatus, DocumentStatus, ExtensionOutcome, PaxType, ServiceType } from "../../generated/prisma/enums";

interface DocumentItem {
  id: string;
  type: string;
  status: DocumentStatus;
  fileUrl: string | null;
  createdAt: string;
  passengerId: string | null;
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
  serviceType: ServiceType;
  selectedQuotation: { id: string; sellingPrice: string; margin: string } | null;
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
}

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
}: {
  bookingId: string;
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
    setCreatingExtraPayment(true);
    try {
      await postJson(`/api/bookings/${bookingId}/extra-payments`, { amount, description: extraDescription.trim() });
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/crm/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary transition-colors duration-150 hover:text-ink-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Bookings
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">
            {SERVICE_TYPE_LABELS[booking.serviceType]} ·{" "}
            <Link href={`/crm/leads/${booking.leadId}`} className="text-ink-accent hover:underline">
              {booking.leadReferenceId}
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-ink-heading">{booking.bookingId}</h1>
          <p className="text-xs text-ink-tertiary">
            {booking.customer.name} · {booking.customer.mobile} · Created {formatDate(booking.createdAt)}
          </p>
          <CopyPaymentLinkButton customerToken={booking.customerToken} />
        </div>
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
              // refund rule applies to every payment below, and that's only
              // ever computed server-side (GET /api/bookings/[id]).
              onChanged={() => setReloadNonce((current) => current + 1)}
            />
          ) : null}
        </div>
      </div>

      {missingDocuments.length > 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {missingDocuments.length} document{missingDocuments.length === 1 ? "" : "s"} flagged missing — queued for
          customer notification (Phase 5).
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-heading">Payments</h2>
              {booking.status === "PENDING" && !hasPendingPayment ? (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => void handleCreatePayment("gateway")} isLoading={creatingPayment}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Payment Link
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void handleCreatePayment("bank-transfer")} isLoading={creatingPayment}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Bank Transfer
                  </Button>
                </div>
              ) : null}
              {/* Step 52 — Extra Payment Collection: only once the booking has a real, active lifecycle (not still awaiting its primary payment, and not dead), and no other payment is already pending. */}
              {!["PENDING", "CANCELLED", "REFUNDED"].includes(booking.status) && !hasPendingPayment && !showExtraPaymentForm ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowExtraPaymentForm(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Extra Payment
                </Button>
              ) : null}
            </div>
            {showExtraPaymentForm ? (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-hairline p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr]">
                  <input
                    type="number"
                    min={1}
                    placeholder="Amount"
                    value={extraAmount}
                    onChange={(event) => setExtraAmount(event.target.value)}
                    className={cn(fieldControlClass, fieldBorderClass(false))}
                  />
                  <input
                    type="text"
                    placeholder="Reason (e.g. Additional baggage fee)"
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
                    onChanged={() => setReloadNonce((current) => current + 1)}
                    canApproveRefunds={canApproveRefunds}
                    canApproveBankTransfer={canApproveBankTransfer}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-heading">Passengers</h2>
              <span className="text-xs text-ink-tertiary">Each passenger has its own status and documents.</span>
            </div>
            <div className="mb-4">
              <AddDocumentForm
                bookingId={booking.id}
                passengers={booking.passengers}
                onAdded={() => setReloadNonce((current) => current + 1)}
              />
            </div>
            {booking.passengers.length === 0 ? (
              <p className="text-sm text-ink-tertiary">No passengers linked to this booking.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {booking.passengers.map((passenger) => {
                  const passengerDocuments = booking.documents.filter((document) => document.passengerId === passenger.id);
                  const protectionPlan = booking.protectionPlans.find((plan) => plan.passengerId === passenger.id);
                  const checklist = booking.documentChecklistSnapshot?.passengers.find((p) => p.passengerId === passenger.id);
                  return (
                    <div key={passenger.id} className="rounded-lg border border-hairline p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink-primary">{passenger.fullName}</p>
                        <BookingPassengerStatusControl
                          bookingId={booking.id}
                          passengerId={passenger.id}
                          status={passenger.status}
                          onChanged={(status) =>
                            setBooking((current) =>
                              current
                                ? {
                                    ...current,
                                    passengers: current.passengers.map((p) => (p.id === passenger.id ? { ...p, status } : p)),
                                  }
                                : current
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
                          <ProtectionPlanControl
                            plan={protectionPlan}
                            onChanged={(updated) =>
                              setBooking((current) =>
                                current
                                  ? { ...current, protectionPlans: current.protectionPlans.map((p) => (p.id === updated.id ? updated : p)) }
                                  : current
                              )
                            }
                          />
                        </div>
                      ) : null}
                      <ReusableDocumentsPrompt
                        passengerId={passenger.id}
                        bookingId={booking.id}
                        onReused={() => setReloadNonce((current) => current + 1)}
                      />
                      <div className="mt-2 flex flex-col gap-2">
                        {passengerDocuments.length === 0 ? (
                          <p className="text-xs text-ink-tertiary">No documents for this passenger yet.</p>
                        ) : (
                          passengerDocuments.map((document) => {
                            const extractionType = extractionTypeForDocument(document.type);
                            return (
                              <div key={document.id} className="rounded-md bg-surface-2 px-3 py-2 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-ink-primary">{document.type}</span>
                                  <DocumentStatusControl
                                    documentId={document.id}
                                    status={document.status}
                                    onChanged={(status) =>
                                      setBooking((current) =>
                                        current
                                          ? {
                                              ...current,
                                              documents: current.documents.map((doc) => (doc.id === document.id ? { ...doc, status } : doc)),
                                            }
                                          : current
                                      )
                                    }
                                  />
                                </div>
                                {extractionType ? (
                                  <DocumentExtractionReview
                                    documentId={document.id}
                                    documentType={extractionType}
                                    hasFile={Boolean(document.fileUrl)}
                                    onUploaded={() => setReloadNonce((current) => current + 1)}
                                  />
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {(() => {
            const generalDocuments = booking.documents.filter((document) => !document.passengerId);
            if (generalDocuments.length === 0) return null;
            return (
              <section className="rounded-xl border border-hairline bg-surface-1 p-5">
                <h2 className="mb-3 text-sm font-semibold text-ink-heading">General Documents</h2>
                <p className="mb-3 text-xs text-ink-tertiary">Not tied to a specific passenger.</p>
                <div className="flex flex-col gap-2">
                  {generalDocuments.map((document) => {
                    const extractionType = extractionTypeForDocument(document.type);
                    return (
                      <div key={document.id} className="rounded-lg border border-hairline p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-ink-primary">{document.type}</span>
                          <DocumentStatusControl
                            documentId={document.id}
                            status={document.status}
                            onChanged={(status) =>
                              setBooking((current) =>
                                current
                                  ? {
                                      ...current,
                                      documents: current.documents.map((doc) => (doc.id === document.id ? { ...doc, status } : doc)),
                                    }
                                  : current
                              )
                            }
                          />
                        </div>
                        {extractionType ? (
                          <DocumentExtractionReview
                            documentId={document.id}
                            documentType={extractionType}
                            hasFile={Boolean(document.fileUrl)}
                            onUploaded={() => setReloadNonce((current) => current + 1)}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-hairline bg-surface-1 p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-heading">Customer</h2>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-ink-primary">{booking.customer.name}</p>
              <p className="text-xs text-ink-tertiary">{booking.customer.mobile}</p>
              {booking.customer.email ? <p className="text-xs text-ink-tertiary">{booking.customer.email}</p> : null}
            </div>
          </section>

          {booking.selectedQuotation ? (
            <section className="rounded-xl border border-hairline bg-surface-1 p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink-heading">Selected Quotation</h2>
              <p className="text-sm text-ink-secondary">
                Selling Price: <span className="font-medium text-ink-primary">₹{booking.selectedQuotation.sellingPrice}</span>
              </p>
              <p className="text-xs text-ink-tertiary">Margin (internal): ₹{booking.selectedQuotation.margin}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
