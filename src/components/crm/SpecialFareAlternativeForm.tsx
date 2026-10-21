"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { buildQuoteFormSchema, type QuoteFormValues } from "@/lib/validation/quotation-schema";
import { flightFieldsFromSectors } from "@/lib/quotations/itinerary";
import { EMPTY_SEGMENT, SpecialFareQuoteFields, type PaxCountsView } from "./SpecialFareQuoteFields";
import { cn } from "@/lib/cn";

interface AirportOption {
  code: string;
  name: string;
  city: string;
  country: string;
}

interface NamedOption {
  id: string;
  code?: string;
  name: string;
}

function toIsoOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Client doc 2026-10-20 (A12) / 2026-10-21 — "Alternative option must be same form": the Special Fare
 * alternative is entered with the quote's own fields (Direct / Connecting sectors, fare rules,
 * cancellation / no-show, vendor cost + selling price per Adult / Child / Infant), plus the vendor.
 * Hands the action route the alternative payload; the server derives route / totals again.
 */
export function SpecialFareAlternativeForm({
  bookingId,
  airports,
  airlines,
  vendors,
  paxCounts,
  startFrom,
  pending,
  onSubmit,
}: {
  bookingId: string;
  airports: AirportOption[];
  airlines: NamedOption[];
  vendors: NamedOption[];
  paxCounts: PaxCountsView;
  /** The paid quote's airports — the alternative starts from them. */
  startFrom: { from: string | null; to: string | null };
  pending: boolean;
  onSubmit: (alternative: Record<string, unknown>) => void;
}) {
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(buildQuoteFormSchema(true)),
    defaultValues: { itinerary: [{ ...EMPTY_SEGMENT, from: startFrom.from ?? "", to: startFrom.to ?? "" }] },
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;
  const { fields: sectorFields, append: appendSector, remove: removeSector } = useFieldArray({ control, name: "itinerary" });

  const airportLabel = (code: string) => {
    const airport = airports.find((row) => row.code === code);
    return airport ? `${airport.city} (${airport.code})` : code;
  };

  const submit = (values: QuoteFormValues) => {
    const itinerary = (values.itinerary ?? []).map((segment) => ({ ...segment, departAt: toIsoOrUndefined(segment.departAt), arriveAt: toIsoOrUndefined(segment.arriveAt) }));
    const flight = flightFieldsFromSectors(itinerary);
    const vendor = vendors.find((row) => row.id === values.vendorId);
    onSubmit({
      itinerary,
      route: flight ? `${airportLabel(flight.fromAirportCode)} → ${airportLabel(flight.toAirportCode)}` : "",
      reportingTime: values.reportingTime || undefined,
      baggageAllowance: values.baggageAllowance,
      fareType: values.fareType,
      fareRules: values.fareRules,
      cancellationAllowed: values.cancellationAllowed,
      cancellationCharge: values.cancellationCharge,
      noShowCharge: values.noShowCharge,
      customerCancellationPolicy: values.customerCancellationPolicy,
      adultFare: values.adultFare,
      childFare: values.childFare,
      infantFare: values.infantFare,
      adultVendorCost: values.adultVendorCost,
      childVendorCost: values.childVendorCost,
      infantVendorCost: values.infantVendorCost,
      sellingPrice: values.sellingPrice,
      vendorCost: values.vendorCost,
      vendorId: values.vendorId,
      vendorName: vendor?.name,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Vendor" htmlFor={`sf-alt-vendor-${bookingId}`} error={errors.vendorId?.message} required>
          <select id={`sf-alt-vendor-${bookingId}`} className={cn(fieldControlClass, fieldBorderClass(!!errors.vendorId))} {...register("vendorId")}>
            <option value="">Select the vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </FormField>
        <TextField label="Reporting time" placeholder="e.g. 3 hours before departure" {...register("reportingTime")} error={errors.reportingTime?.message} />
      </div>
      <SpecialFareQuoteFields
        form={form}
        sectorFields={sectorFields}
        appendSector={appendSector}
        removeSector={removeSector}
        airports={airports}
        airlines={airlines.map((airline) => ({ id: airline.id, code: airline.code ?? "", name: airline.name }))}
        paxCounts={paxCounts}
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSubmit(submit)()} isLoading={pending} disabled={pending}>
          Record unavailability
        </Button>
      </div>
    </div>
  );
}
