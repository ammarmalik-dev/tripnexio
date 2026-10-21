"use client";

import { useEffect, useState } from "react";
import { useWatch, type FieldArrayWithId, type UseFieldArrayAppend, type UseFieldArrayRemove, type UseFormReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { MAX_ITINERARY_SEGMENTS, type ItinerarySegment } from "@/lib/quotations/itinerary";
import type { QuoteFormValues } from "@/lib/validation/quotation-schema";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format-currency";

export interface PaxCountsView {
  adult: number;
  child: number;
  infant: number;
}

interface AirportOption {
  code: string;
  name: string;
  city: string;
  country: string;
}

interface AirlineOption {
  id: string;
  code: string;
  name: string;
}

export const EMPTY_SEGMENT: ItinerarySegment = { from: "", to: "", departAt: "", arriveAt: "", airline: "", flightNumber: "", departTerminal: "", arriveTerminal: "", notes: "" };

const PAX_ROWS = [
  { key: "adult", label: "Adult", fare: "adultFare", cost: "adultVendorCost" },
  { key: "child", label: "Child", fare: "childFare", cost: "childVendorCost" },
  { key: "infant", label: "Infant", fare: "infantFare", cost: "infantVendorCost" },
] as const;

function rupees(value: number): string {
  return formatRupees(value);
}

/**
 * Client doc 2026-10-14 ("CRM Quotation Form — Cleanup") — the Special Fare
 * part of the quote builder:
 * - Direct / Connecting flight. Direct is one simple flight; Connecting adds
 *   sectors in travel order. Each sector has its own airports, times, airline,
 *   flight number and terminals. The quote's route / airline / times are
 *   derived from the sectors (server-side too).
 * - Airports are searched inside the Departure / Arrival fields (code, name or
 *   city), from the Airport master. A new quote starts from the customer's
 *   requested airports.
 * - Fare rules + cancellation allowed / charge / no-show charge, plus optional
 *   extra cancellation terms.
 * - Vendor cost (internal) and selling price per Adult / Child / Infant; the
 *   totals and the margin are calculated, never typed twice.
 */
export function SpecialFareQuoteFields({
  form,
  sectorFields,
  appendSector,
  removeSector,
  airports,
  airlines,
  paxCounts,
}: {
  form: UseFormReturn<QuoteFormValues>;
  sectorFields: FieldArrayWithId<QuoteFormValues, "itinerary", "id">[];
  appendSector: UseFieldArrayAppend<QuoteFormValues, "itinerary">;
  removeSector: UseFieldArrayRemove;
  airports: AirportOption[];
  airlines: AirlineOption[];
  paxCounts: PaxCountsView;
}) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;
  const [connecting, setConnecting] = useState(sectorFields.length > 1);
  const rates = useWatch({ control, name: ["adultFare", "childFare", "infantFare", "adultVendorCost", "childVendorCost", "infantVendorCost"] });
  const cancellationAllowed = useWatch({ control, name: "cancellationAllowed" });

  const [adultFare, childFare, infantFare, adultCost, childCost, infantCost] = rates.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null));
  const anyFare = adultFare !== null || childFare !== null || infantFare !== null;
  const anyCost = adultCost !== null || childCost !== null || infantCost !== null;
  const sellingTotal = (adultFare ?? 0) * paxCounts.adult + (childFare ?? 0) * paxCounts.child + (infantFare ?? 0) * paxCounts.infant;
  const costTotal = (adultCost ?? 0) * paxCounts.adult + (childCost ?? 0) * paxCounts.child + (infantCost ?? 0) * paxCounts.infant;

  // The totals the API stores (it recalculates them too) — one entry per passenger type, never typed twice.
  useEffect(() => {
    setValue("sellingPrice", anyFare ? Math.round(sellingTotal * 100) / 100 : undefined, { shouldValidate: false });
    setValue("vendorCost", anyCost ? Math.round(costTotal * 100) / 100 : (undefined as unknown as number), { shouldValidate: false });
  }, [anyFare, anyCost, sellingTotal, costTotal, setValue]);

  const chooseType = (next: boolean) => {
    setConnecting(next);
    if (next && sectorFields.length < 2) appendSector({ ...EMPTY_SEGMENT });
    if (!next && sectorFields.length > 1) removeSector(sectorFields.map((_, index) => index).slice(1));
  };

  const numberField = (name: "adultFare" | "childFare" | "infantFare" | "adultVendorCost" | "childVendorCost" | "infantVendorCost" | "cancellationCharge" | "noShowCharge") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) });
  const textField = (name: "baggageAllowance" | "fareType" | "fareRules" | "customerCancellationPolicy") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : value) });

  const sectorErrors = errors.itinerary;
  // Client doc 2026-10-20 (A11) — vendor cost and selling price for Adult, Child and Infant are always offered.
  const shownRows = PAX_ROWS;

  return (
    <div className="flex flex-col gap-4">
      {/* Typing a city, airport name or code filters this list inside every airport field (no separate search bar). */}
      <datalist id="sf-airports">
        {airports.map((airport) => (
          <option key={airport.code} value={airport.code}>
            {`${airport.city} — ${airport.name} (${airport.code}), ${airport.country}`}
          </option>
        ))}
      </datalist>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
        <legend className="px-1 text-sm font-medium text-ink-heading">Flight details</legend>
        <div role="radiogroup" aria-label="Flight type" className="flex flex-wrap gap-2">
          {[
            { value: false, label: "Direct flight" },
            { value: true, label: "Connecting flight" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={connecting === option.value}
              onClick={() => chooseType(option.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
                connecting === option.value ? "border-accent bg-accent/10 text-ink-accent" : "border-hairline text-ink-secondary hover:text-ink-primary"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-tertiary">
          Starts from the customer&apos;s requested airports — change them here for this quote only. Same-country airports = Domestic, otherwise International (the
          matching T&amp;C apply).
        </p>

        <ol className="flex flex-col gap-3">
          {sectorFields.map((field, index) => {
            const rowErrors = sectorErrors?.[index];
            return (
              <li key={field.id} className={cn("flex flex-col gap-3", connecting && "rounded-lg border border-hairline bg-surface-2 p-3")}>
                {connecting ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-heading">Sector {index + 1}</span>
                    {sectorFields.length > 2 ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeSector(index)} aria-label={`Remove sector ${index + 1}`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField
                    label="Departure airport"
                    list="sf-airports"
                    autoComplete="off"
                    placeholder="City, airport or code"
                    required
                    {...register(`itinerary.${index}.from` as const, { setValueAs: (value: string) => value.trim().toUpperCase() })}
                    error={rowErrors?.from?.message}
                  />
                  <TextField
                    label="Arrival airport"
                    list="sf-airports"
                    autoComplete="off"
                    placeholder="City, airport or code"
                    required
                    {...register(`itinerary.${index}.to` as const, { setValueAs: (value: string) => value.trim().toUpperCase() })}
                    error={rowErrors?.to?.message}
                  />
                  <TextField label="Departure date & time" type="datetime-local" {...register(`itinerary.${index}.departAt` as const)} error={rowErrors?.departAt?.message} />
                  <TextField label="Arrival date & time" type="datetime-local" {...register(`itinerary.${index}.arriveAt` as const)} error={rowErrors?.arriveAt?.message} />
                  <FormField label="Airline" htmlFor={`sf-sector-${index}-airline`} error={rowErrors?.airline?.message}>
                    <select
                      id={`sf-sector-${index}-airline`}
                      className={cn(fieldControlClass, fieldBorderClass(!!rowErrors?.airline))}
                      {...register(`itinerary.${index}.airline` as const)}
                    >
                      <option value="">{airlines.length === 0 ? "No active airlines configured" : "Select an airline"}</option>
                      {airlines.map((airline) => (
                        <option key={airline.id} value={airline.code}>
                          {airline.name} ({airline.code})
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <TextField label="Flight number" placeholder="e.g. 6E 21" {...register(`itinerary.${index}.flightNumber` as const)} error={rowErrors?.flightNumber?.message} />
                  <TextField label="Departure terminal" placeholder="e.g. T3" {...register(`itinerary.${index}.departTerminal` as const)} error={rowErrors?.departTerminal?.message} />
                  <TextField label="Arrival terminal" placeholder="e.g. T1" {...register(`itinerary.${index}.arriveTerminal` as const)} error={rowErrors?.arriveTerminal?.message} />
                </div>
                {connecting ? (
                  <Textarea
                    label="Sector notes"
                    rows={2}
                    hint="Shown to the customer (e.g. layover, change of terminal)."
                    {...register(`itinerary.${index}.notes` as const)}
                    error={rowErrors?.notes?.message}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
        {sectorErrors?.message ? <p className="text-xs text-error">{sectorErrors.message}</p> : null}
        {connecting ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => appendSector({ ...EMPTY_SEGMENT })}
            disabled={sectorFields.length >= MAX_ITINERARY_SEGMENTS}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Sector
          </Button>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Baggage allowance" placeholder="e.g. 15 kg check-in + 7 kg cabin" {...textField("baggageAllowance")} error={errors.baggageAllowance?.message} />
          <TextField label="Fare type" placeholder="e.g. Special Fare" {...textField("fareType")} error={errors.fareType?.message} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
        <legend className="px-1 text-sm font-medium text-ink-heading">Fare &amp; cancellation (shown to the customer)</legend>
        <Textarea label="Fare rules" rows={2} {...textField("fareRules")} error={errors.fareRules?.message} hint="Date change, baggage and other airline fare rules." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="Cancellation allowed" htmlFor="sf-cancellation-allowed">
            <select
              id="sf-cancellation-allowed"
              className={cn(fieldControlClass, fieldBorderClass(false))}
              value={cancellationAllowed === undefined || cancellationAllowed === null ? "" : cancellationAllowed ? "yes" : "no"}
              onChange={(event) =>
                setValue("cancellationAllowed", event.target.value === "" ? undefined : event.target.value === "yes", { shouldDirty: true })
              }
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No — non-refundable</option>
            </select>
          </FormField>
          {cancellationAllowed !== false ? (
            <>
              <TextField label="Cancellation charge (₹)" type="number" step="0.01" min={0} {...numberField("cancellationCharge")} error={errors.cancellationCharge?.message} />
              <TextField label="No-show charge (₹)" type="number" step="0.01" min={0} {...numberField("noShowCharge")} error={errors.noShowCharge?.message} />
            </>
          ) : (
            <p className="self-end pb-2 text-xs text-ink-tertiary sm:col-span-2">The customer sees this fare as non-refundable — no charges are shown.</p>
          )}
        </div>
        <Textarea
          label="Customer cancellation terms (optional)"
          rows={2}
          {...textField("customerCancellationPolicy")}
          error={errors.customerCancellationPolicy?.message}
          hint="Only for conditions the fields above don't already cover."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
        <legend className="px-1 text-sm font-medium text-ink-heading">Price per passenger</legend>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-tertiary">
                <th scope="col" className="pb-2 font-medium">Passenger</th>
                <th scope="col" className="pb-2 font-medium">Vendor cost (internal)</th>
                <th scope="col" className="pb-2 font-medium">Selling price</th>
              </tr>
            </thead>
            <tbody>
              {shownRows.map((row) => (
                <tr key={row.key} className="align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium text-ink-primary">
                    {row.label} <span className="font-normal text-ink-tertiary">× {paxCounts[row.key]}</span>
                  </th>
                  <td className="py-1.5 pr-3">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      aria-label={`${row.label} vendor cost`}
                      className={cn(fieldControlClass, fieldBorderClass(!!errors[row.cost]), "h-9")}
                      {...numberField(row.cost)}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      aria-label={`${row.label} selling price`}
                      className={cn(fieldControlClass, fieldBorderClass(!!errors[row.fare]), "h-9")}
                      {...numberField(row.fare)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline text-sm">
                <th scope="row" className="pt-2 text-left font-medium text-ink-heading">Total</th>
                <td className="pt-2 text-ink-secondary">{anyCost ? rupees(costTotal) : "—"}</td>
                <td className="pt-2 font-semibold text-ink-heading">{anyFare ? rupees(sellingTotal) : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {anyFare && anyCost ? <p className="text-xs text-ink-tertiary">Margin (internal): {rupees(sellingTotal - costTotal)}</p> : null}
        {errors.sellingPrice?.message || errors.vendorCost?.message ? (
          <p className="text-xs text-error">Enter the vendor cost and selling price for each passenger type.</p>
        ) : null}
      </fieldset>
    </div>
  );
}
