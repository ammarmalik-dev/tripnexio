"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
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
import { MAX_ITINERARY_SEGMENTS, flightFieldsFromSectors, type ItinerarySegment } from "@/lib/quotations/itinerary";
import { EMPTY_SEGMENT, SpecialFareQuoteFields, type PaxCountsView } from "./SpecialFareQuoteFields";
import { VISA_CHANGE_EXCLUSIONS, VISA_CHANGE_INCLUSIONS } from "@/lib/visa-change/inclusions";
import { PaxCostingFields } from "./PaxCostingFields";
import { EMPTY_A2A_FLIGHTS } from "@/lib/visa-change/a2a-flights";

/** B32 — the form fields of each Airport-to-Airport leg. */
const A2A_LEGS = [
  {
    key: "exit",
    title: "Exit Flight",
    hint: "Out of the UAE, from the exit airport.",
    from: "exitFromAirportCode",
    to: "exitToAirportCode",
    airline: "exitAirlineCode",
    flightNumber: "exitFlightNumber",
    departAt: "exitDepartAt",
  },
  {
    key: "reentry",
    title: "Re-entry Flight",
    hint: "Back into the UAE — usually the same aircraft returning, the passenger stays airside.",
    from: "reentryFromAirportCode",
    to: "reentryToAirportCode",
    airline: "reentryAirlineCode",
    flightNumber: "reentryFlightNumber",
    departAt: "reentryDepartAt",
  },
] as const;

/** P22 — which button submitted the form: keep/save as an unsent draft, or make it visible to the customer. */
export type QuoteFormAction = "draft" | "send";

/**
 * P22 — create: a brand-new quote ("Save as draft" / "Create & send").
 * editDraft: an unsent draft ("Save draft" / "Save & send").
 * revise: a sent, unselected quote — edited in place as Revision N+1 and
 * re-sent to the customer ("Send revision").
 */
export type QuoteFormMode = "create" | "editDraft" | "revise";

/** Line separator for the one-item-per-line textareas. */
const NL = "\n";


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

function normalizeForSubmit(values: QuoteFormValues, isFlightQuote: boolean): QuoteFormValues {
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
    // Special Fare — the route / airline / flight / times come from the sectors (the server derives them again).
    const fromSectors = isFlightQuote ? flightFieldsFromSectors(next.itinerary) : null;
    if (fromSectors) Object.assign(next, fromSectors);
  }
  return next;
}

/** An older Special Fare quote entered its flight in the main fields: open it as one sector so it's edited in one place. */
function initialSectors(values: Partial<QuoteFormValues> | undefined, request: { fromCode: string | null; toCode: string | null } | null): ItinerarySegment[] {
  if (values?.itinerary && values.itinerary.length > 0) return values.itinerary;
  // Client doc 2026-10-14 — a new quote starts from the customer's requested airports.
  if (!values?.fromAirportCode || !values.toAirportCode) return [{ ...EMPTY_SEGMENT, from: request?.fromCode ?? "", to: request?.toCode ?? "" }];
  return [
    {
      ...EMPTY_SEGMENT,
      from: values.fromAirportCode,
      to: values.toAirportCode,
      departAt: values.flightDateTime ?? "",
      arriveAt: values.arrivalDateTime ?? "",
      airline: values.airline ?? "",
      flightNumber: values.flightNumber ?? "",
    },
  ];
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
  /** Special Fare: the lead's Adult / Child / Infant counts (prices are per passenger). */
  paxCounts?: PaxCountsView;
  /** Special Fare: the customer's requested airports — a new quote starts from them. */
  flightRequest?: { fromCode: string | null; toCode: string | null } | null;
  /** Client doc 2026-10-15 — Visa Extension / Visa Change: the lead's passengers, costed one by one. */
  passengers?: { id: string; fullName: string }[];
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
  paxCounts = { adult: 1, child: 0, infant: 0 },
  flightRequest = null,
  passengers = [],
}: QuoteBuilderFormProps) {
  // Client doc 2026-10-15 (D1/D3, E4) — Visa Extension / Visa Change: Vendor + cost / fine / selling per passenger.
  const perPaxCosting = isExtension || hasItinerary;
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(buildQuoteFormSchema(isFlightQuote)),
    defaultValues: {
      ...initialValues,
      ...(perPaxCosting
        ? {
            paxCosting:
              initialValues?.paxCosting && initialValues.paxCosting.length > 0
                ? initialValues.paxCosting
                : passengers.map((passenger) => ({ passengerId: passenger.id, cost: 0, fine: 0, selling: 0 })),
          }
        : {}),
      ...(multiSectorItinerary ? { itinerary: isFlightQuote ? initialSectors(initialValues, flightRequest) : (initialValues?.itinerary ?? []) } : {}),
      // Client testing 2026-10-09 (B32) — an Airport-to-Airport option has its own exit and re-entry flights.
      ...(hasItinerary && showFlightDetails ? { a2aFlights: initialValues?.a2aFlights ?? { ...EMPTY_A2A_FLIGHTS } } : {}),
      // Client testing 2026-10-09 (B34) — a new Visa Change option starts with the
      // method's standard inclusions / exclusions filled in (staff can edit them).
      ...(hasItinerary
        ? {
            inclusions: initialValues?.inclusions ?? (VISA_CHANGE_INCLUSIONS[showFlightDetails ? "AIRPORT_TO_AIRPORT" : "BORDER_EXIT"].join(NL) as unknown as string[]),
            exclusions: initialValues?.exclusions ?? (VISA_CHANGE_EXCLUSIONS.join(NL) as unknown as string[]),
          }
        : {}),
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = form;
  const { fields: sectorFields, append: appendSector, remove: removeSector, move: moveSector } = useFieldArray({
    control,
    name: "itinerary",
  });
  const [pendingAction, setPendingAction] = useState<QuoteFormAction | null>(null);
  // Client testing 2026-10-09 (F2) — one search box filters every airport dropdown;
  // airports already chosen always stay in the list.
  const [airportQuery, setAirportQuery] = useState("");
  const chosenFrom = useWatch({ control, name: "fromAirportCode" });
  const chosenTo = useWatch({ control, name: "toAirportCode" });
  const chosenSectors = useWatch({ control, name: "itinerary" });
  const chosenA2A = useWatch({ control, name: "a2aFlights" });
  const isA2A = hasItinerary && showFlightDetails;

  // Every button stays type="button" and calls handleSubmit directly (see the
  // multi-step button type-toggle race in CLAUDE.md) — the <form> itself
  // never submits, so pressing Enter can't send a quote to a customer.
  const submitWith = (action: QuoteFormAction) => {
    setPendingAction(action);
    void handleSubmit(async (values) => {
      await onSubmit(normalizeForSubmit(values, isFlightQuote), action);
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

  const keepCodes = new Set(
    [
      chosenFrom,
      chosenTo,
      ...(chosenSectors ?? []).flatMap((sector) => [sector?.from, sector?.to]),
      chosenA2A?.exitFromAirportCode,
      chosenA2A?.exitToAirportCode,
      chosenA2A?.reentryFromAirportCode,
      chosenA2A?.reentryToAirportCode,
    ].filter(Boolean)
  );
  const query = airportQuery.trim().toLowerCase();
  const visibleAirports = query
    ? airports.filter(
        (airport) => keepCodes.has(airport.code) || `${airport.code} ${airport.city} ${airport.name} ${airport.country}`.toLowerCase().includes(query)
      )
    : airports;
  const airportsByCountry = [
    ...new Map(visibleAirports.map((airport) => [airport.country, visibleAirports.filter((a) => a.country === airport.country)])).entries(),
  ];
  const airportSearch =
    airports.length > 8 ? (
      <TextField
        label="Find airport"
        name="airport-search"
        placeholder="Type a city, airport or code (e.g. DXB)"
        value={airportQuery}
        onChange={(event) => setAirportQuery(event.target.value)}
        hint="Filters the airport lists below."
      />
    ) : null;
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
        // Client doc 2026-10-14 — the cleaned-up Special Fare form (flight, fare & cancellation, price per passenger).
        <>
          <SpecialFareQuoteFields
            form={form}
            sectorFields={sectorFields}
            appendSector={appendSector}
            removeSector={removeSector}
            airports={airports}
            airlines={airlines}
            paxCounts={paxCounts}
          />
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
          {perPaxCosting ? (
            <PaxCostingFields
              passengers={passengers}
              initial={initialValues?.paxCosting}
              suggestedSelling={feeSuggestion ? Object.fromEntries(feeSuggestion.lines.map((line) => [line.passengerId, line.rate])) : undefined}
              onChange={(lines) => setValue("paxCosting", lines, { shouldDirty: true })}
              error={errors.paxCosting?.message ?? errors.feeAmount?.message}
            />
          ) : null}
          {perPaxCosting ? null : (
          <>
          <TextField
            label={isExtension ? "Extension Fee (₹)" : hasItinerary ? "Selling Price (₹)" : "Fee (₹)"}
            type="number"
            step="0.01"
            required
            {...numberField("feeAmount")}
            error={errors.feeAmount?.message}
          />
          <TextField
            label={isExtension ? "Fine (₹)" : hasItinerary ? "Fine / Other Charges (₹)" : "Fine / Charges (₹)"}
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
          </>
          )}
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
            hint="One per line. Pre-filled with the standard list for this method."
            {...register("inclusions", { setValueAs: splitLines })}
            error={errors.inclusions?.message}
          />
          <Textarea
            label="Not included"
            rows={4}
            hint="One per line. Pre-filled with the standard list."
            {...register("exclusions", { setValueAs: splitLines })}
            error={errors.exclusions?.message}
          />
        </div>
      ) : null}

      {isA2A ? (
        // Client testing 2026-10-09 (B32) — no "multiple flights": exactly one exit and one
        // re-entry flight per option, every field required; the option's own vendor cost and
        // selling price below are this flight pair's price.
        <fieldset className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
          <legend className="px-1 text-sm font-medium text-ink-heading">Flights for this option</legend>
          {airportSearch}
          {A2A_LEGS.map((leg) => {
            const legErrors = errors.a2aFlights;
            return (
              <div key={leg.key} className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink-heading">{leg.title}</p>
                    <p className="text-xs text-ink-tertiary">{leg.hint}</p>
                  </div>
                  {leg.key === "reentry" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const exit = getValues("a2aFlights");
                        if (!exit) return;
                        setValue("a2aFlights.reentryFromAirportCode", exit.exitToAirportCode, { shouldValidate: false });
                        setValue("a2aFlights.reentryToAirportCode", exit.exitFromAirportCode, { shouldValidate: false });
                        setValue("a2aFlights.reentryAirlineCode", exit.exitAirlineCode, { shouldValidate: false });
                      }}
                    >
                      Same aircraft returns
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="From" htmlFor={`a2a-${leg.from}`} error={legErrors?.[leg.from]?.message} required>
                    <select
                      id={`a2a-${leg.from}`}
                      className={cn(fieldControlClass, fieldBorderClass(!!legErrors?.[leg.from]))}
                      {...register(`a2aFlights.${leg.from}`)}
                    >
                      {airportOptions("Select airport")}
                    </select>
                  </FormField>
                  <FormField label="To" htmlFor={`a2a-${leg.to}`} error={legErrors?.[leg.to]?.message} required>
                    <select
                      id={`a2a-${leg.to}`}
                      className={cn(fieldControlClass, fieldBorderClass(!!legErrors?.[leg.to]))}
                      {...register(`a2aFlights.${leg.to}`)}
                    >
                      {airportOptions("Select airport")}
                    </select>
                  </FormField>
                  <TextField
                    label="Departure (date & time)"
                    type="datetime-local"
                    required
                    {...register(`a2aFlights.${leg.departAt}`)}
                    error={legErrors?.[leg.departAt]?.message}
                  />
                  <FormField label="Airline" htmlFor={`a2a-${leg.airline}`} error={legErrors?.[leg.airline]?.message} required>
                    <select
                      id={`a2a-${leg.airline}`}
                      className={cn(fieldControlClass, fieldBorderClass(!!legErrors?.[leg.airline]))}
                      {...register(`a2aFlights.${leg.airline}`)}
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
                    required
                    {...register(`a2aFlights.${leg.flightNumber}`)}
                    error={legErrors?.[leg.flightNumber]?.message}
                  />
                </div>
              </div>
            );
          })}
          <TextField
            label="Reporting Time"
            placeholder="e.g. 3 hours before departure"
            required
            {...register("a2aFlights.reportingTime")}
            error={errors.a2aFlights?.reportingTime?.message}
          />
        </fieldset>
      ) : null}

      {multiSectorItinerary && !isFlightQuote ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-dashed border-hairline p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-accent">
            {isFlightQuote ? "Flight sectors" : "Multi-sector itinerary (optional)"}
          </legend>
          <p className="text-xs text-ink-tertiary">
            {isFlightQuote
              ? "Add each flight leg in travel order (one sector for a direct flight). The quote's route, airline, flight number and times come from these; same-country airports = Domestic, otherwise International, and the matching T&C apply."
              : "Add each flight leg in travel order. Everything here is shown to the customer on their quote page."}
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
                    hint="Shown to the customer (e.g. layover)."
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

      {isFlightQuote || perPaxCosting ? null : (
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
        {hasItinerary ? null : (
          <TextField
            label={isFlightQuote ? "Airline fare inside price (₹)" : "Government / airline fee inside total (₹)"}
            type="number"
            step="0.01"
            hint="Optional — shown separately on the invoice; GST is never charged on it."
            {...numberField("governmentFee")}
            error={errors.governmentFee?.message}
          />
        )}
      </div>
      )}

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
