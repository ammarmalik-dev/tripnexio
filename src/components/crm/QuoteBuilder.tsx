"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { QuoteBuilderForm, type QuoteFormAction } from "./QuoteBuilderForm";
import { QuoteCard, type QuoteCardData } from "./QuoteCard";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { isFlightQuote, supportsItinerary, capturesAirline } from "@/lib/quotations/pricing";
import { ProtectionPlanNote } from "./ProtectionPlanNote";
import { toast } from "@/components/ui/Toaster";
import type { ServiceType, LeadStatus } from "../../generated/prisma/enums";
import type { QuoteFormValues } from "@/lib/validation/quotation-schema";
import { parseStoredItinerary, supportsMultiSectorItinerary } from "@/lib/quotations/itinerary";

interface VendorRecord {
  id: string;
  name: string;
  /** Business Rules §8 — overall recommendation score (1-5), a sort/display aid only. */
  score?: number;
}

interface AirlineRecord {
  id: string;
  code: string;
  name: string;
}

type FetchState = "loading" | "success" | "error";

/** P22 — the quote currently open in the builder for editing (an unsent draft) or revising (a sent, unselected quote). */
interface EditingQuote {
  quotation: QuoteCardData;
  mode: "editDraft" | "revise";
}

/** ISO instant → the local wall-clock "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalInput(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toNumber(value: string | null | undefined): number | undefined {
  return value == null ? undefined : Number(value);
}

function toText(value: string | null | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

/** Pre-fills the quote builder from an existing quotation (API strings/Decimals → form values). */
function quoteToFormValues(quotation: QuoteCardData, flightQuote: boolean): Partial<QuoteFormValues> {
  return {
    vendorId: quotation.vendorId,
    vendorCost: toNumber(quotation.vendorCost),
    validityExpiresAt: toLocalInput(quotation.validityExpiresAt),
    alternativeOfId: toText(quotation.alternativeOfId),
    airline: toText(quotation.airline),
    flightNumber: toText(quotation.flightNumber),
    route: toText(quotation.route),
    flightDateTime: toLocalInput(quotation.flightDateTime),
    arrivalDateTime: toLocalInput(quotation.arrivalDateTime),
    baggageAllowance: toText(quotation.baggageAllowance),
    fareType: toText(quotation.fareType),
    adultFare: toNumber(quotation.adultFare),
    childFare: toNumber(quotation.childFare),
    infantFare: toNumber(quotation.infantFare),
    // Selling price is only staff-entered on a flight quote; every other service's total is computed server-side.
    sellingPrice: flightQuote ? toNumber(quotation.sellingPrice) : undefined,
    terminal: toText(quotation.terminal),
    reportingTime: toText(quotation.reportingTime),
    fareRules: toText(quotation.fareRules),
    restrictions: toText(quotation.restrictions),
    vendorReference: toText(quotation.vendorReference),
    bookingDeadline: toLocalInput(quotation.bookingDeadline),
    cancellationAllowed: quotation.cancellationAllowed ?? undefined,
    cancellationCharge: toNumber(quotation.cancellationCharge),
    chargeBasis: toText(quotation.chargeBasis),
    timeCondition: toText(quotation.timeCondition),
    noShowCharge: toNumber(quotation.noShowCharge),
    estimatedRefund: toNumber(quotation.estimatedRefund),
    customerCancellationPolicy: toText(quotation.customerCancellationPolicy),
    feeAmount: toNumber(quotation.feeAmount),
    fineOrCharges: toNumber(quotation.fineOrCharges),
    otherCharges: toNumber(quotation.otherCharges),
    flightTicketPrice: toNumber(quotation.flightTicketPrice),
    // Always sent back on a non-flight edit so the server re-validates it
    // against the (possibly changed) total; "" clears it.
    couponCode: flightQuote ? undefined : (quotation.couponCode ?? ""),
    itinerary: parseStoredItinerary(quotation.itinerary).map((segment) => ({
      from: segment.from,
      to: segment.to,
      departAt: toLocalInput(segment.departAt) ?? "",
      arriveAt: toLocalInput(segment.arriveAt) ?? "",
      airline: segment.airline ?? "",
      flightNumber: segment.flightNumber ?? "",
      notes: segment.notes ?? "",
    })),
  };
}

export function QuoteBuilder({
  leadId,
  serviceType,
  leadStatus,
  onLeadChanged,
}: {
  leadId: string;
  serviceType: ServiceType;
  leadStatus: LeadStatus;
  onLeadChanged: () => void;
}) {
  const flightQuote = isFlightQuote(serviceType);
  const hasItinerary = supportsItinerary(serviceType);
  const airlineCapable = capturesAirline(serviceType);
  const multiSector = supportsMultiSectorItinerary(serviceType);
  const [state, setState] = useState<FetchState>("loading");
  const [quotations, setQuotations] = useState<QuoteCardData[]>([]);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [airlines, setAirlines] = useState<AirlineRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [revalidatingId, setRevalidatingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingQuote | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [quotationList, vendorList, airlineList] = await Promise.all([
          getJson<QuoteCardData[]>(`/api/quotations?leadId=${leadId}`),
          getJson<VendorRecord[]>(`/api/vendors?service=${serviceType}`),
          airlineCapable ? getJson<AirlineRecord[]>("/api/airlines") : Promise.resolve<AirlineRecord[]>([]),
        ]);
        if (cancelled) return;
        setQuotations(quotationList);
        setVendors(vendorList);
        setAirlines(airlineList);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load quotations. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId, serviceType, reloadNonce, airlineCapable]);

  const vendorName = (vendorId: string) => vendors.find((vendor) => vendor.id === vendorId)?.name ?? "Unknown vendor";

  const handleCreate = async (values: QuoteFormValues, action: QuoteFormAction) => {
    setSubmitting(true);
    try {
      await postJson("/api/quotations", { ...values, leadId, saveAsDraft: action === "draft" });
      toast.success(action === "draft" ? "Draft saved — not visible to the customer yet." : "Quote created and sent to the customer.");
      setShowForm(false);
      setReloadNonce((current) => current + 1);
      if (action === "send") onLeadChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save this quote. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // P22 — a draft edit (optionally followed by sending it), or a sent quote's revision.
  const handleEditSubmit = async (values: QuoteFormValues, action: QuoteFormAction) => {
    if (!editing) return;
    const { quotation, mode } = editing;
    setSubmitting(true);
    try {
      await patchJson(`/api/quotations/${quotation.id}`, values);
      if (mode === "editDraft" && action === "send") {
        await postJson(`/api/quotations/${quotation.id}/send`, {});
        toast.success("Draft saved and sent to the customer.");
        onLeadChanged();
      } else if (mode === "revise") {
        toast.success(`Revision ${(quotation.revision ?? 1) + 1} sent — the customer has been notified.`);
      } else {
        toast.success("Draft updated.");
      }
      setEditing(null);
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save this quote. Please try again.");
      // A saved-but-not-sent draft still changed — refresh the list either way.
      setReloadNonce((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async (id: string) => {
    setSendingId(id);
    try {
      await postJson(`/api/quotations/${id}/send`, {});
      toast.success("Quote sent to the customer.");
      setReloadNonce((current) => current + 1);
      onLeadChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't send this quote. Please try again.");
    } finally {
      setSendingId(null);
    }
  };

  const startEditing = (quotation: QuoteCardData, mode: EditingQuote["mode"]) => {
    setShowForm(false);
    setEditing({ quotation, mode });
  };

  const handleSelect = async (id: string) => {
    setSelectingId(id);
    try {
      await patchJson(`/api/quotations/${id}/select`, {});
      toast.success("Quote selected — every other option on this lead is now expired.");
      setReloadNonce((current) => current + 1);
      onLeadChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't select this quote. Please try again.");
    } finally {
      setSelectingId(null);
    }
  };

  const handleRevalidate = async (id: string, validityExpiresAt: string, reason: string) => {
    setRevalidatingId(id);
    try {
      await patchJson(`/api/quotations/${id}/revalidate`, { validityExpiresAt, reason });
      toast.success("Quote revalidated — the same payment link is active again.");
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't revalidate this quote. Please try again.");
    } finally {
      setRevalidatingId(null);
    }
  };

  const canQuote = leadStatus !== "CONVERTED" && leadStatus !== "LOST" && leadStatus !== "CLOSED";
  const alternativeOptions = quotations
    .filter((quotation) => !quotation.alternativeOfId && quotation.id !== editing?.quotation.id)
    .map((quotation) => ({
      id: quotation.id,
      label: `${quotation.airline ?? "Quotation"}${quotation.route ? ` · ${quotation.route}` : ""}`,
    }));

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Quotations</h2>
        {canQuote && !showForm && !editing ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {hasItinerary ? "New Itinerary Option" : "New Quote"}
          </Button>
        ) : null}
      </div>

      {serviceType === "NEW_VISA" ? <ProtectionPlanNote /> : null}

      {showForm ? (
        <div className="mb-4">
          <QuoteBuilderForm
            leadId={leadId}
            isFlightQuote={flightQuote}
            hasItinerary={hasItinerary}
            showAirlineField={serviceType === "RETURN_TICKET"}
            isExtension={serviceType === "VISA_EXTENSION"}
            vendors={vendors}
            airlines={airlines}
            alternativeOptions={flightQuote ? alternativeOptions : []}
            multiSectorItinerary={multiSector}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            submitting={submitting}
          />
        </div>
      ) : null}

      {editing ? (
        <div className="mb-4 flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-accent">
            {editing.mode === "revise" ? `Revise quote (currently Revision ${editing.quotation.revision ?? 1})` : "Edit draft quote"}
          </h3>
          <QuoteBuilderForm
            // Remount per quote/mode so defaultValues re-initialise.
            key={`${editing.quotation.id}-${editing.mode}`}
            leadId={leadId}
            isFlightQuote={flightQuote}
            hasItinerary={hasItinerary}
            showAirlineField={serviceType === "RETURN_TICKET"}
            isExtension={serviceType === "VISA_EXTENSION"}
            vendors={vendors}
            airlines={airlines}
            alternativeOptions={flightQuote ? alternativeOptions : []}
            multiSectorItinerary={multiSector}
            mode={editing.mode}
            initialValues={quoteToFormValues(editing.quotation, flightQuote)}
            currentRevision={editing.quotation.revision ?? 1}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditing(null)}
            submitting={submitting}
          />
        </div>
      ) : null}

      {state === "loading" ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load quotations"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state === "success" && quotations.length === 0 && !showForm ? (
        <EmptyState title="No quotes yet" description="Build a quote for this lead using the button above." />
      ) : null}

      {state === "success" && quotations.length > 0 ? (
        <div className="flex flex-col gap-3">
          {quotations.map((quotation) => (
            <QuoteCard
              key={quotation.id}
              quotation={quotation}
              isFlightQuote={flightQuote}
              hasItinerary={hasItinerary}
              vendorName={vendorName(quotation.vendorId)}
              now={now}
              onSelect={() => void handleSelect(quotation.id)}
              selecting={selectingId === quotation.id}
              onRevalidate={(validityExpiresAt, reason) => void handleRevalidate(quotation.id, validityExpiresAt, reason)}
              revalidating={revalidatingId === quotation.id}
              onEdit={canQuote ? () => startEditing(quotation, "editDraft") : undefined}
              onSend={canQuote ? () => void handleSend(quotation.id) : undefined}
              sending={sendingId === quotation.id}
              onRevise={canQuote ? () => startEditing(quotation, "revise") : undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
