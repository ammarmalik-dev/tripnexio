"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { BookingStatusControl } from "./BookingStatusControl";
import { BookingPassengerStatusControl } from "./BookingPassengerStatusControl";
import { ExtensionOutcomeControl } from "./ExtensionOutcomeControl";
import { PaymentPanel, type PaymentData } from "./PaymentPanel";
import { DocumentStatusControl } from "./DocumentStatusControl";
import { AddDocumentForm } from "./AddDocumentForm";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
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

interface BookingDetailResponse {
  id: string;
  bookingId: string;
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
}

type FetchState = "loading" | "success" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function BookingDetail({ bookingId, canApproveRefunds }: { bookingId: string; canApproveRefunds: boolean }) {
  const [state, setState] = useState<FetchState>("loading");
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [creatingPayment, setCreatingPayment] = useState(false);

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

  const handleCreatePayment = async () => {
    setCreatingPayment(true);
    try {
      await postJson(`/api/bookings/${bookingId}/payments`, {});
      toast.success("Payment created.");
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create a payment. Please try again.");
    } finally {
      setCreatingPayment(false);
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
                <Button type="button" size="sm" variant="ghost" onClick={() => void handleCreatePayment()} isLoading={creatingPayment}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Create Payment
                </Button>
              ) : null}
            </div>
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
                      <div className="mt-2 flex flex-col gap-2">
                        {passengerDocuments.length === 0 ? (
                          <p className="text-xs text-ink-tertiary">No documents for this passenger yet.</p>
                        ) : (
                          passengerDocuments.map((document) => (
                            <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
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
                          ))
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
                  {generalDocuments.map((document) => (
                    <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline p-3 text-sm">
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
                  ))}
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
