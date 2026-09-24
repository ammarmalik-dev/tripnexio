"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { QuoteBuilderForm } from "./QuoteBuilderForm";
import { QuoteCard, type QuoteCardData } from "./QuoteCard";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { isFlightQuote, supportsItinerary, capturesAirline } from "@/lib/quotations/pricing";
import { ProtectionPlanNote } from "./ProtectionPlanNote";
import { toast } from "@/components/ui/Toaster";
import type { ServiceType, LeadStatus } from "../../generated/prisma/enums";
import type { QuoteFormValues } from "@/lib/validation/quotation-schema";

interface VendorRecord {
  id: string;
  name: string;
}

interface AirlineRecord {
  id: string;
  code: string;
  name: string;
}

type FetchState = "loading" | "success" | "error";

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
  const [state, setState] = useState<FetchState>("loading");
  const [quotations, setQuotations] = useState<QuoteCardData[]>([]);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [airlines, setAirlines] = useState<AirlineRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
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

  const handleCreate = async (values: QuoteFormValues) => {
    setSubmitting(true);
    try {
      await postJson("/api/quotations", { ...values, leadId });
      toast.success("Quote saved.");
      setShowForm(false);
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save this quote. Please try again.");
    } finally {
      setSubmitting(false);
    }
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

  const canQuote = leadStatus !== "CONVERTED" && leadStatus !== "LOST" && leadStatus !== "CLOSED";
  const alternativeOptions = quotations
    .filter((quotation) => !quotation.alternativeOfId)
    .map((quotation) => ({
      id: quotation.id,
      label: `${quotation.airline ?? "Quotation"}${quotation.route ? ` · ${quotation.route}` : ""}`,
    }));

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Quotations</h2>
        {canQuote && !showForm ? (
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
            isFlightQuote={flightQuote}
            hasItinerary={hasItinerary}
            showAirlineField={serviceType === "RETURN_TICKET"}
            vendors={vendors}
            airlines={airlines}
            alternativeOptions={flightQuote ? alternativeOptions : []}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
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
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
