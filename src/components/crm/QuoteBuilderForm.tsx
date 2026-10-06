"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { CouponCodeOptions } from "./CouponCodeOptions";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { Button } from "@/components/ui/Button";
import { buildQuoteFormSchema, type QuoteFormValues } from "@/lib/validation/quotation-schema";
import { FLIGHT_QUOTE_MAX_VALIDITY_MINUTES } from "@/lib/quotations/pricing";
import { getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { MAX_ITINERARY_SEGMENTS, type ItinerarySegment } from "@/lib/quotations/itinerary";

/** P22 — which button submitted the form: keep/save as an unsent draft, or make it visible to the customer. */
export type QuoteFormAction = "draft" | "send";

/**
 * P22 — create: a brand-new quote ("Save as draft" / "Create & send").
 * editDraft: an unsent draft ("Save draft" / "Save & send").
 * revise: a sent, unselected quote — edited in place as Revision N+1 and
 * re-sent to the customer ("Send revision").
 */
export type QuoteFormMode = "create" | "editDraft" | "revise";

const EMPTY_SEGMENT: ItinerarySegment = { from: "", to: "", departAt: "", arriveAt: "", airline: "", flightNumber: "", notes: "" };

const DATE_TIME_KEYS = ["flightDateTime", "arrivalDateTime", "validityExpiresAt", "bookingDeadline"] as const;

/** datetime-local values are local wall-clock time — convert to an absolute ISO instant in the browser, never on the server. */
/** Textarea "one item per line" → array (Visa Change inclusions / exclusions). */
function splitLines(value: unknown): unknown {
  return typeof value === "string"
    ? value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : value;
}

function toIsoOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeForSubmit(values: QuoteFormValues): QuoteFormValues {
  const next: QuoteFormValues = { ...values };
  for (const key of DATE_TIME_KEYS) {
    next[key] = toIsoOrUndefined(values[key]);
  }
  if (values.itinerary) {
    next.itinerary = values.itinerary.map((segment) => ({
      ...segment,
      departAt: toIsoOrUndefined(segment.departAt),
      arriveAt: toIsoOrUndefined(segment.arriveAt),
    }));
  }
  return next;
}

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
  /** Business Rules §8 — overall recommendation score (1-5), a sort/display aid only. Optional so other VendorOption producers (if any ever appear) aren't forced to supply it. */
  score?: number;
}

interface AirlineOption {
  id: string;
  code: string;
  name: string;
}

interface AirportOption {
  code: string;
  name: string;
  city: string;
  country: string;
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
  /** Client corrections 2026-10-05 — false for a Border Exit quote: no itinerary / flight ticket fields. */
  showFlightDetails?: boolean;
  /** Return Ticket: no flight-quote/itinerary shape, but staff can still optionally record which airline it's for. */
  showAirlineField?: boolean;
  /** P13 — Visa Extension: extension fee / fine / other charges breakdown. */
  isExtension?: boolean;
  vendors: VendorOption[];
  airlines: AirlineOption[];
  /** Client corrections 2026-10-05 — Airport master (Special Fare route, itinerary sectors); no free-text airports. */
  airports?: AirportOption[];
  alternativeOptions: AlternativeOption[];
  /** P22 — Visa Change / Special Fare: show the multi-sector itinerary builder. */
  multiSectorItinerary?: boolean;
  /** P22 — create (default), edit an unsent draft, or revise a sent quote. */
  mode?: QuoteFormMode;
  /** P22 — pre-filled values when editing/revising (datetime fields in datetime-local format). */
  initialValues?: Partial<QuoteFormValues>;
  /** Shown on the revise banner — the quote's current revision number. */
  currentRevision?: number;
  onSubmit: (values: QuoteFormValues, action: QuoteFormAction) => Promise<void>;
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
  showFlightDetails = true,
  showAirlineField = false,
  isExtension = false,
  vendors,
  airlines,
  airports = [],
  alternativeOptions,
  multiSectorItinerary = false,
  mode = "create",
  initialValues,
  currentRevision = 1,
  onSubmit,
  onCancel,
  submitting,
}: QuoteBuilderFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(buildQuoteFormSchema(isFlightQuote)),
    defaultValues: {
      ...initialValues,
      ...(multiSectorItinerary ? { itinerary: initialValues?.itinerary ?? [] } : {}),
    },
  });
  const { fields: sectorFields, append: appendSector, remove: removeSector, move: moveSector } = useFieldArray({
    control,
    name: "itinerary",
  });
  const [pendingAction, setPendingAction] = useState<QuoteFormAction | null>(null);

  // Every button stays type="button" and calls handleSubmit directly (see the
  // multi-step button type-toggle race in CLAUDE.md) — the <form> itself
  // never submits, so pressing Enter can't send a quote to a customer.
  const submitWith = (action: QuoteFormAction) => {
    setPendingAction(action);
    void handleSubmit(async (values) => {
      await onSubmit(normalizeForSubmit(values), action);
    })().finally(() => setPendingAction(null));
  };

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

  const numberField = (name: "vendorCost" | "adultFare" | "childFare" | "infantFare" | "sellingPrice" | "feeAmount" | "fineOrCharges" | "otherCharges" | "governmentFee" | "flightTicketPrice" | "cancellationCharge" | "noShowCharge" | "estimatedRefund") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) });

  const optionalField = (
    name:
      | "flightNumber"
      | "route"
      | "baggageAllowance"
      | "fareType"
      | "terminal"
      | "reportingTime"
      | "fareRules"
      | "restrictions"
      | "vendorReference"
      | "chargeBasis"
      | "timeCondition"
      | "customerCancellationPolicy"
  ) =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : value) });

  // datetime-local inputs: blank = not set; converted to ISO in normalizeForSubmit().
  const dateTimeField = (name: (typeof DATE_TIME_KEYS)[number]) =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : value) });

  const airlineSelect = (label: string, required: boolean) => (
    <FormField label={label} htmlFor="airline" error={errors.airline?.message} required={required}>
      <select
        id="airline"
        defaultValue={initialValues?.airline ?? ""}
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

  const sectorErrors = errors.itinerary;
  const sectorListError = sectorErrors?.message;

  const airportsByCountry = [...new Map(airports.map((airport) => [airport.country, airports.filter((a) => a.country === airport.country)])).entries()];
  const airportOptions = (placeholder: string) => (
    <>
      <option value="">{airports.length === 0 ? "No active airports in the master" : placeholder}</option>
      {airportsByCountry.map(([country, list]) => (
        <optgroup key={country} label={country}>
          {list.map((airport) => (
            <option key={airport.code} value={airport.code}>
              {airport.city} — {airport.name} ({airport.code})
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
  const routeAirportSelect = (name: "fromAirportCode" | "toAirportCode", label: string) => (
    <FormField label={label} htmlFor={name} error={errors[name]?.message} required>
      <select
        id={name}
        defaultValue={initialValues?.[name] ?? ""}
        className={cn(fieldControlClass, fieldBorderClass(!!errors[name]))}
        {...register(name, { setValueAs: (value: string) => (value === "" ? undefined : value) })}
      >
        {airportOptions(name === "fromAirportCode" ? "Select departure airport" : "Select arrival airport")}
      </select>
    </FormField>
  );

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-1 p-4"
    >
      {mode === "revise" ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          This quote has already been sent. Sending a revision updates it in place as Revision {currentRevision + 1}, records every
          change in the audit trail, and re-notifies the customer with the revised quote.
        </p>
      ) : null}
      {mode === "editDraft" ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-tertiary">
          Draft — not visible to the customer until you send it.
        </p>
      ) : null}
      <FormField label="Vendor" htmlFor="vendorId" error={errors.vendorId?.message} required>
        <select
          id="vendorId"
          defaultValue={initialValues?.vendorId ?? ""}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.vendorId))}
          {...register("vendorId")}
        >
          <option value="" disabled>
            {vendors.length === 0 ? "No active vendors for this service" : "Select a vendor"}
          </option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
              {vendor.score != null ? ` (score ${vendor.score}/5)` : ""}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {routeAirportSelect("fromAirportCode", "From (airport)")}
            {routeAirportSelect("toAirportCode", "To (airport)")}
          </div>
          <p className="-mt-2 text-xs text-ink-tertiary">
            Same-country airports = Domestic, otherwise International — the matching Terms &amp; Conditions are applied automatically.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Departure"
              type="datetime-local"
              {...dateTimeField("flightDateTime")}
              error={errors.flightDateTime?.message}
            />
            <TextField
              label="Arrival"
              type="datetime-local"
              {...dateTimeField("arrivalDateTime")}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Terminal" placeholder="e.g. T2" {...optionalField("terminal")} error={errors.terminal?.message} />
            <TextField
              label="Reporting Time"
              placeholder="e.g. 3 hours before departure"
              {...optionalField("reportingTime")}
              error={errors.reportingTime?.message}
            />
          </div>
          <Textarea label="Fare Rules" rows={2} {...optionalField("fareRules")} error={errors.fareRules?.message} />
          <Textarea label="Restrictions" rows={2} {...optionalField("restrictions")} error={errors.restrictions?.message} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Vendor Reference (internal)"
              {...optionalField("vendorReference")}
              error={errors.vendorReference?.message}
              hint="Never shown to the customer."
            />
            <TextField label="Booking Deadline" type="datetime-local" {...dateTimeField("bookingDeadline")} error={errors.bookingDeadline?.message} />
          </div>

          <fieldset className="flex flex-col gap-4 rounded-lg border border-hairline p-4">
            <legend className="px-1 text-sm font-medium text-ink-heading">Cancellation &amp; refund terms (shown to the customer)</legend>
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input type="checkbox" {...register("cancellationAllowed")} />
              Cancellation allowed
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField label="Cancellation Charge (₹)" type="number" step="0.01" {...numberField("cancellationCharge")} error={errors.cancellationCharge?.message} />
              <TextField label="No-show Charge (₹)" type="number" step="0.01" {...numberField("noShowCharge")} error={errors.noShowCharge?.message} />
              <TextField label="Estimated Refund (₹)" type="number" step="0.01" {...numberField("estimatedRefund")} error={errors.estimatedRefund?.message} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Charge Basis" placeholder="e.g. Per passenger" {...optionalField("chargeBasis")} error={errors.chargeBasis?.message} />
              <TextField
                label="Time Condition"
                placeholder="e.g. More than 24 hours before departure"
                {...optionalField("timeCondition")}
                error={errors.timeCondition?.message}
              />
            </div>
            <Textarea
              label="Customer Cancellation Policy"
              rows={3}
              {...optionalField("customerCancellationPolicy")}
              error={errors.customerCancellationPolicy?.message}
              hint="Exactly what the customer reads before paying."
            />
          </fieldset>

          {alternativeOptions.length > 0 ? (
            <FormField
              label="Alternative Route"
              htmlFor="alternativeOfId"
              hint="Only set this when offering a different route/option instead of what the customer originally requested."
            >
              <select
                id="alternativeOfId"
                defaultValue={initialValues?.alternativeOfId ?? ""}
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
            label={isExtension ? "Extension Fee (₹)" : "Fee (₹)"}
            type="number"
            step="0.01"
            required
            {...numberField("feeAmount")}
            error={errors.feeAmount?.message}
          />
          <TextField
            label={isExtension ? "Fine (₹)" : "Fine / Charges (₹)"}
            type="number"
            step="0.01"
            hint="Optional — added on top of the fee."
            {...numberField("fineOrCharges")}
            error={errors.fineOrCharges?.message}
          />
          {isExtension ? (
            <TextField
              label="Other Charges (₹)"
              type="number"
              step="0.01"
              hint="Optional — shown to the customer as its own line."
              {...numberField("otherCharges")}
              error={errors.otherCharges?.message}
            />
          ) : null}
          {hasItinerary && showFlightDetails ? (
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
            list="crm-coupon-codes"
            hint={
              mode === "create"
                ? "Optional — pick an available code or type one; validated on save."
                : "Optional — re-validated on save; clear it to remove the coupon."
            }
            {...register("couponCode")}
            error={errors.couponCode?.message}
          />
          <CouponCodeOptions id="crm-coupon-codes" />
        </div>
      )}

      {hasItinerary && !isFlightQuote ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Textarea
            label="What's included"
            rows={4}
            hint="One per line. Leave empty for the standard list for this method."
            {...register("inclusions", { setValueAs: splitLines })}
            error={errors.inclusions?.message}
          />
          <Textarea
            label="Not included"
            rows={4}
            hint="One per line. Leave empty for: Fines, Border / immigration fees, Meals."
            {...register("exclusions", { setValueAs: splitLines })}
            error={errors.exclusions?.message}
          />
        </div>
      ) : null}

      {hasItinerary && showFlightDetails ? (
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
            <TextField label="Departure" type="datetime-local" {...dateTimeField("flightDateTime")} error={errors.flightDateTime?.message} />
            <TextField label="Arrival" type="datetime-local" {...dateTimeField("arrivalDateTime")} error={errors.arrivalDateTime?.message} />
          </div>
          <TextField
            label="Baggage Allowance"
            placeholder="e.g. 30kg checked"
            {...optionalField("baggageAllowance")}
            error={errors.baggageAllowance?.message}
          />
        </fieldset>
      ) : null}

      {multiSectorItinerary ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-dashed border-hairline p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-accent">
            Multi-sector itinerary (optional)
          </legend>
          <p className="text-xs text-ink-tertiary">
            Add each flight leg in travel order. Everything here is shown to the customer on their quote page.
          </p>
          {sectorFields.length === 0 ? <p className="text-xs text-ink-tertiary">No sectors added.</p> : null}
          <ol className="flex flex-col gap-3">
            {sectorFields.map((field, index) => {
              const rowErrors = sectorErrors?.[index];
              return (
                <li key={field.id} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-heading">Sector {index + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveSector(index, index - 1)}
                        disabled={index === 0}
                        aria-label={`Move sector ${index + 1} up`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveSector(index, index + 1)}
                        disabled={index === sectorFields.length - 1}
                        aria-label={`Move sector ${index + 1} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSector(index)}
                        aria-label={`Remove sector ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="From" htmlFor={`itinerary-${index}-from`} error={rowErrors?.from?.message} required>
                      <select
                        id={`itinerary-${index}-from`}
                        className={cn(fieldControlClass, fieldBorderClass(!!rowErrors?.from))}
                        {...register(`itinerary.${index}.from` as const)}
                      >
                        {airportOptions("Select airport")}
                      </select>
                    </FormField>
                    <FormField label="To" htmlFor={`itinerary-${index}-to`} error={rowErrors?.to?.message} required>
                      <select
                        id={`itinerary-${index}-to`}
                        className={cn(fieldControlClass, fieldBorderClass(!!rowErrors?.to))}
                        {...register(`itinerary.${index}.to` as const)}
                      >
                        {airportOptions("Select airport")}
                      </select>
                    </FormField>
                    <TextField
                      label="Departure"
                      type="datetime-local"
                      {...register(`itinerary.${index}.departAt` as const)}
                      error={rowErrors?.departAt?.message}
                    />
                    <TextField
                      label="Arrival"
                      type="datetime-local"
                      {...register(`itinerary.${index}.arriveAt` as const)}
                      error={rowErrors?.arriveAt?.message}
                    />
                    <FormField label="Airline" htmlFor={`itinerary-${index}-airline`} error={rowErrors?.airline?.message}>
                      <select
                        id={`itinerary-${index}-airline`}
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
                    <TextField
                      label="Flight Number"
                      placeholder="e.g. G9 123"
                      {...register(`itinerary.${index}.flightNumber` as const)}
                      error={rowErrors?.flightNumber?.message}
                    />
                  </div>
                  <Textarea
                    label="Sector Notes"
                    rows={2}
                    hint="Shown to the customer (e.g. terminal change, layover)."
                    {...register(`itinerary.${index}.notes` as const)}
                    error={rowErrors?.notes?.message}
                  />
                </li>
              );
            })}
          </ol>
          {sectorListError ? <p className="text-xs text-error">{sectorListError}</p> : null}
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
        <TextField
          label={isFlightQuote ? "Airline fare inside price (₹)" : "Government / airline fee inside total (₹)"}
          type="number"
          step="0.01"
          hint="Optional — shown separately on the invoice; GST is never charged on it."
          {...numberField("governmentFee")}
          error={errors.governmentFee?.message}
        />
      </div>

      <TextField
        label="Validity Expires At"
        type="datetime-local"
        max={isFlightQuote ? maxValidityLocalIso() : undefined}
        hint={isFlightQuote ? `Optional — up to ${FLIGHT_QUOTE_MAX_VALIDITY_MINUTES} minutes from now.` : "Optional."}
        {...dateTimeField("validityExpiresAt")}
        error={errors.validityExpiresAt?.message}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        {mode === "revise" ? (
          <Button type="button" size="sm" onClick={() => submitWith("send")} isLoading={submitting && pendingAction === "send"} disabled={submitting}>
            Send Revision
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => submitWith("draft")}
              isLoading={submitting && pendingAction === "draft"}
              disabled={submitting}
            >
              {mode === "editDraft" ? "Save Draft" : "Save as Draft"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => submitWith("send")}
              isLoading={submitting && pendingAction === "send"}
              disabled={submitting}
            >
              {mode === "editDraft" ? "Save & Send" : "Create & Send"}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
