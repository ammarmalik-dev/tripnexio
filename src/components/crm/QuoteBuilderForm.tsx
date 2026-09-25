"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { buildQuoteFormSchema, type QuoteFormValues } from "@/lib/validation/quotation-schema";
import { FLIGHT_QUOTE_MAX_VALIDITY_MINUTES } from "@/lib/quotations/pricing";
import { getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

// Mirrors VisaChangeFeeSuggestion in src/lib/quotations/visa-change-pricing.ts
// — duplicated as a plain client-side type rather than imported, since that
// module pulls in `db` (Step 42 already hit exactly this class of bug:
// a type-looking import from a DB-backed module dragging `pg` into the
// browser bundle).
interface VisaChangeFeeSuggestion {
  configured: boolean;
  total: number;
  lines: { passengerId: string; fullName: string; nationality: string | null; paxType: string; rate: number | null }[];
}

interface VendorOption {
  id: string;
  name: string;
}

interface AirlineOption {
  id: string;
  code: string;
  name: string;
}

interface AlternativeOption {
  id: string;
  label: string;
}

interface QuoteBuilderFormProps {
  leadId: string;
  isFlightQuote: boolean;
  /** Visa Change: this quote is one itinerary option (flight details + ticket price on top of the visa fee). */
  hasItinerary?: boolean;
  /** Return Ticket: no flight-quote/itinerary shape, but staff can still optionally record which airline it's for. */
  showAirlineField?: boolean;
  vendors: VendorOption[];
  airlines: AirlineOption[];
  alternativeOptions: AlternativeOption[];
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

function maxValidityLocalIso(): string {
  const max = new Date(Date.now() + FLIGHT_QUOTE_MAX_VALIDITY_MINUTES * 60 * 1000);
  max.setSeconds(0, 0);
  return new Date(max.getTime() - max.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function QuoteBuilderForm({
  leadId,
  isFlightQuote,
  hasItinerary = false,
  showAirlineField = false,
  vendors,
  airlines,
  alternativeOptions,
  onSubmit,
  onCancel,
  submitting,
}: QuoteBuilderFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(buildQuoteFormSchema(isFlightQuote)),
  });

  // Item 9 (client-message/PENDING_WORK_PROMPTS.md) — Visa Change's
  // nationality/adult/child-wise fee suggestion, from the lead's own
  // passengers against the central PricingRule table. Only fetched for
  // Visa Change (hasItinerary is that service's own flag); staff still
  // types/confirms the final feeAmount, this just gives them a real
  // starting number instead of a blind guess.
  const [feeSuggestion, setFeeSuggestion] = useState<VisaChangeFeeSuggestion | null>(null);
  useEffect(() => {
    if (!hasItinerary) return;
    let cancelled = false;
    void getJson<VisaChangeFeeSuggestion>(`/api/leads/${leadId}/visa-change-fee-suggestion`)
      .then((result) => {
        if (!cancelled) setFeeSuggestion(result);
      })
      .catch(() => {
        if (!cancelled) setFeeSuggestion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hasItinerary, leadId]);

  const numberField = (name: "vendorCost" | "adultFare" | "childFare" | "infantFare" | "sellingPrice" | "feeAmount" | "fineOrCharges" | "flightTicketPrice") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) });

  const optionalField = (name: "flightNumber" | "route" | "baggageAllowance" | "fareType" | "couponCode") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : value) });

  const airlineSelect = (label: string, required: boolean) => (
    <FormField label={label} htmlFor="airline" error={errors.airline?.message} required={required}>
      <select
        id="airline"
        defaultValue=""
        className={cn(fieldControlClass, fieldBorderClass(!!errors.airline))}
        {...register("airline", { setValueAs: (value: string) => (value === "" ? undefined : value) })}
      >
        <option value="">{airlines.length === 0 ? "No active airlines configured" : required ? "Select an airline" : "Not decided yet"}</option>
        {airlines.map((airline) => (
          <option key={airline.id} value={airline.code}>
            {airline.name} ({airline.code})
          </option>
        ))}
      </select>
    </FormField>
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-4"
    >
      <FormField label="Vendor" htmlFor="vendorId" error={errors.vendorId?.message} required>
        <select
          id="vendorId"
          defaultValue=""
          className={cn(fieldControlClass, fieldBorderClass(!!errors.vendorId))}
          {...register("vendorId")}
        >
          <option value="" disabled>
            {vendors.length === 0 ? "No active vendors for this service" : "Select a vendor"}
          </option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </FormField>

      {isFlightQuote ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {airlineSelect("Airline", false)}
            <TextField label="Flight Number" {...optionalField("flightNumber")} error={errors.flightNumber?.message} />
          </div>
          <TextField label="Route" placeholder="e.g. BOM → DXB" {...optionalField("route")} error={errors.route?.message} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Departure"
              type="datetime-local"
              {...register("flightDateTime")}
              error={errors.flightDateTime?.message}
            />
            <TextField
              label="Arrival"
              type="datetime-local"
              {...register("arrivalDateTime")}
              error={errors.arrivalDateTime?.message}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Baggage Allowance"
              placeholder="e.g. 30kg checked"
              {...optionalField("baggageAllowance")}
              error={errors.baggageAllowance?.message}
            />
            <TextField label="Fare Type" placeholder="e.g. Special Fare" {...optionalField("fareType")} error={errors.fareType?.message} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField label="Adult Fare (₹)" type="number" step="0.01" {...numberField("adultFare")} error={errors.adultFare?.message} />
            <TextField label="Child Fare (₹)" type="number" step="0.01" {...numberField("childFare")} error={errors.childFare?.message} />
            <TextField
              label="Infant Fare (₹)"
              type="number"
              step="0.01"
              {...numberField("infantFare")}
              error={errors.infantFare?.message}
            />
          </div>

          {alternativeOptions.length > 0 ? (
            <FormField
              label="Alternative Route"
              htmlFor="alternativeOfId"
              hint="Only set this when offering a different route/option instead of what the customer originally requested."
            >
              <select
                id="alternativeOfId"
                defaultValue=""
                className={cn(fieldControlClass, fieldBorderClass(false))}
                {...register("alternativeOfId", { setValueAs: (value: string) => (value === "" ? undefined : value) })}
              >
                <option value="">No — this is the requested route</option>
                {alternativeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    Alternative to: {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hasItinerary && feeSuggestion && feeSuggestion.lines.length > 0 ? (
            <div className="col-span-full flex flex-col gap-2 rounded-lg border border-hairline bg-surface-2 p-3 text-xs">
              <p className="font-medium text-ink-secondary">Suggested fee, from Admin-configured nationality/passenger-type rates:</p>
              <ul className="flex flex-col gap-1">
                {feeSuggestion.lines.map((line) => (
                  <li key={line.passengerId} className="flex items-center justify-between text-ink-tertiary">
                    <span>
                      {line.fullName} ({line.paxType.toLowerCase()}{line.nationality ? `, ${line.nationality}` : ""})
                    </span>
                    <span>{line.rate !== null ? `₹${line.rate}` : "no rate configured"}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink-primary">
                  Total: {feeSuggestion.configured ? `₹${feeSuggestion.total}` : `₹${feeSuggestion.total} (some passengers unconfigured)`}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setValue("feeAmount", feeSuggestion.total)}>
                  Use Suggested Total
                </Button>
              </div>
            </div>
          ) : null}
          <TextField
            label="Fee (₹)"
            type="number"
            step="0.01"
            required
            {...numberField("feeAmount")}
            error={errors.feeAmount?.message}
          />
          <TextField
            label="Fine / Charges (₹)"
            type="number"
            step="0.01"
            hint="Optional — added on top of the fee."
            {...numberField("fineOrCharges")}
            error={errors.fineOrCharges?.message}
          />
          {hasItinerary ? (
            <TextField
              label="Flight Ticket (₹)"
              type="number"
              step="0.01"
              hint="Optional — this itinerary's flight-ticket price, added to the total."
              {...numberField("flightTicketPrice")}
              error={errors.flightTicketPrice?.message}
            />
          ) : null}
          {showAirlineField ? airlineSelect("Airline", false) : null}
          <TextField
            label="Coupon Code"
            hint="Optional — validated on save (active, within date range, under usage limit)."
            {...optionalField("couponCode")}
            error={errors.couponCode?.message}
          />
        </div>
      )}

      {hasItinerary ? (
        <fieldset className="flex flex-col gap-4 rounded-lg border border-dashed border-hairline p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-accent">
            Itinerary (optional)
          </legend>
          <p className="text-xs text-ink-tertiary">
            Add one quote per itinerary option (e.g. morning / afternoon / evening flight) so the customer can pick
            the timing that suits them.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {airlineSelect("Airline", false)}
            <TextField label="Flight Number" {...optionalField("flightNumber")} error={errors.flightNumber?.message} />
          </div>
          <TextField label="Route" placeholder="e.g. DXB → MCT" {...optionalField("route")} error={errors.route?.message} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Departure" type="datetime-local" {...register("flightDateTime")} error={errors.flightDateTime?.message} />
            <TextField label="Arrival" type="datetime-local" {...register("arrivalDateTime")} error={errors.arrivalDateTime?.message} />
          </div>
          <TextField
            label="Baggage Allowance"
            placeholder="e.g. 30kg checked"
            {...optionalField("baggageAllowance")}
            error={errors.baggageAllowance?.message}
          />
        </fieldset>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Vendor Cost (₹)"
          type="number"
          step="0.01"
          required
          hint="Internal — never shown to the customer."
          {...numberField("vendorCost")}
          error={errors.vendorCost?.message}
        />
        {isFlightQuote ? (
          <TextField
            label="Selling Price (₹)"
            type="number"
            step="0.01"
            required
            {...numberField("sellingPrice")}
            error={errors.sellingPrice?.message}
          />
        ) : null}
      </div>

      <TextField
        label="Validity Expires At"
        type="datetime-local"
        max={isFlightQuote ? maxValidityLocalIso() : undefined}
        hint={isFlightQuote ? `Optional — up to ${FLIGHT_QUOTE_MAX_VALIDITY_MINUTES} minutes from now.` : "Optional."}
        {...register("validityExpiresAt")}
        error={errors.validityExpiresAt?.message}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={submitting}>
          Save Quote
        </Button>
      </div>
    </form>
  );
}
