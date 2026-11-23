"use client";

import { AirportSearchField } from "@/components/forms/AirportSearchField";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { Button } from "@/components/ui/Button";
import { MANUAL_LEAD_SOURCES, manualLeadSchema, type ManualLeadValues } from "@/lib/validation/manual-lead-schema";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { PaymentLinkAction } from "./PaymentLinkAction";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";
import { useProcessingTypes } from "@/lib/processing-types/use-processing-types";
import { defaultProcessingTypes } from "@/lib/processing-types/defaults";
import { useNewVisaProducts } from "@/lib/new-visa/use-new-visa-products";
import { useNationalities } from "@/lib/use-nationalities";
import type { ManualLeadPricePreview } from "@/lib/leads/manual-lead-pricing";
import { formatRupees } from "@/lib/format-currency";

interface CountryOption {
  id: string;
  code: string;
  name: string;
}

interface OtbAirlineOption {
  code: string;
  name: string;
}

interface ReturnTicketDestinationOption {
  countryId: string;
  countryName: string;
  ratePerApplicant: number;
}

interface ManualLeadResult {
  leadId: string;
  referenceId: string;
  bookingId?: string;
  requiresQuotation: boolean;
  pricingNote?: string;
}

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = (
  Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]
).map(([value, label]) => ({ value, label }));

/**
 * Step 51 (Internal Dashboard Merged §8) — a single-page CRM form, not the
 * multi-step MultiStepRequestFlow the customer-facing website flows use
 * (this is a staff tool, not a customer request). See
 * manual-lead-schema.ts's own doc comment for why the conditional
 * country/airline/destination fields exist even though the client's
 * literal field list didn't name them.
 */
export function ManualLeadForm() {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [newVisaCountries, setNewVisaCountries] = useState<CountryOption[]>([]);
  const { products } = useNewVisaProducts();
  const { options: nationalities } = useNationalities();
  const [preview, setPreview] = useState<ManualLeadPricePreview | null>(null);
  const [airlines, setAirlines] = useState<OtbAirlineOption[]>([]);
  const [destinations, setDestinations] = useState<ReturnTicketDestinationOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ManualLeadResult | null>(null);

  useEffect(() => {
    void getJson<CountryOption[]>("/api/countries").then(setCountries).catch(() => undefined);
    // Client doc 2026-10-20 (E5) — New Visa: only the destinations Admin made live.
    void getJson<CountryOption[]>("/api/countries?service=NEW_VISA").then(setNewVisaCountries).catch(() => undefined);
    void getJson<OtbAirlineOption[]>("/api/otb/airlines").then(setAirlines).catch(() => undefined);
    void getJson<ReturnTicketDestinationOption[]>("/api/return-ticket/destinations").then(setDestinations).catch(() => undefined);
  }, []);

  const methods = useForm<ManualLeadValues>({
    resolver: zodResolver(manualLeadSchema),
    defaultValues: { adultCount: 1, childCount: 0, infantCount: 0 },
  });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = methods;

  const serviceType = watch("serviceType");
  const destinationCountryCode = watch("destinationCountryCode");
  const countryProducts = products.filter((product) => product.countryCode === destinationCountryCode);

  // Client doc 2026-10-20 (K1) — the configured amount, service fee, extra charges, coupon and final payable, live.
  const priceInputs = JSON.stringify({
    serviceType,
    adultCount: watch("adultCount"),
    childCount: watch("childCount"),
    infantCount: watch("infantCount"),
    couponCode: watch("couponCode") || undefined,
    extraCharges: watch("extraCharges"),
    destinationCountryCode,
    newVisaConfigId: watch("newVisaConfigId") || undefined,
    nationalityId: watch("nationalityId") || undefined,
    processingType: watch("processingType") || undefined,
    airlineCode: watch("airlineCode") || undefined,
    returnTicketDestinationCountryId: watch("returnTicketDestinationCountryId") || undefined,
  });
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      async function load() {
        const inputs = JSON.parse(priceInputs) as { serviceType?: string };
        if (!inputs.serviceType) return;
        try {
          const result = await postJson<ManualLeadPricePreview>("/api/leads/manual/preview", inputs);
          if (!cancelled) setPreview(result);
        } catch {
          if (!cancelled) setPreview({ available: false, reason: "Couldn't work out the price.", byQuotation: false });
        }
      }
      void load();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [priceInputs]);
  // P23 — processing-type labels from the Admin master (codes stay normal/urgent).
  const processingService = serviceType === "NEW_VISA" || serviceType === "OTB" ? serviceType : undefined;
  const { state: processingState, options: processingMasterOptions } = useProcessingTypes(processingService);
  const processingOptions = (
    processingService && processingState === "loading" ? defaultProcessingTypes(processingService) : processingMasterOptions
  ).filter((option) => option.code === "normal" || option.code === "urgent");

  const numberField = (name: "adultCount" | "childCount" | "infantCount" | "extraCharges") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) });
  const optionalField = (
    name: "email" | "otherServiceDescription" | "couponCode" | "destinationCountryCode" | "airlineCode" | "returnTicketDestinationCountryId" | "processingType" | "newVisaConfigId" | "nationalityId"
  ) =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : value) });

  const onSubmit = async (values: ManualLeadValues) => {
    setSubmitting(true);
    try {
      const created = await postJson<ManualLeadResult>("/api/leads/manual", values);
      toast.success(`Lead ${created.referenceId} created.`);
      setResult(created);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this lead. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-6">
        <h2 className="text-lg font-semibold text-ink-heading">Lead {result.referenceId} created</h2>
        {result.bookingId ? (
          <>
            <p className="text-sm text-ink-secondary">
              A booking was created with the auto-calculated price. Copy or generate a payment link right here, or go to the booking to collect a bank transfer instead.
            </p>
            <PaymentLinkAction bookingId={result.bookingId} />
            <Link href={`/crm/bookings/${result.bookingId}`}>
              <Button type="button" variant="ghost">
                Go to Booking
              </Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-secondary">
              {result.pricingNote ?? "This service needs a staff-prepared quotation."} Build one from the Lead detail page.
            </p>
            <Link href={`/crm/leads/${result.leadId}`}>
              <Button type="button">Go to Lead</Button>
            </Link>
          </>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => setResult(null)}>
          Create another Manual Lead
        </Button>
      </div>
    );
  }

  return (
    // FormProvider — the shared airport search field (Special Fare) reads the form from context.
    <FormProvider {...methods}>
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 rounded-xl border border-hairline bg-surface-1 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField {...register("fullName")} name="fullName" label="Name" error={errors.fullName?.message} required />
        <TextField {...register("mobile")} name="mobile" label="Mobile" error={errors.mobile?.message} required />
        <TextField {...optionalField("email")} name="email" label="Email" error={errors.email?.message} />
        <FormField label="Source" htmlFor="source" error={errors.source?.message} required>
          <select
            id="source"
            defaultValue=""
            className={cn(fieldControlClass, fieldBorderClass(!!errors.source))}
            {...register("source")}
          >
            <option value="" disabled>
              Select the source
            </option>
            {MANUAL_LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Service" htmlFor="serviceType" error={errors.serviceType?.message} required>
        <select
          id="serviceType"
          defaultValue=""
          className={cn(fieldControlClass, fieldBorderClass(!!errors.serviceType))}
          {...register("serviceType")}
        >
          <option value="" disabled>
            Select a service
          </option>
          {SERVICE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      {serviceType === "OTHER" ? (
        <TextField
          {...optionalField("otherServiceDescription")}
          name="otherServiceDescription"
          label="Other Service"
          placeholder="Describe what the customer is asking for"
          error={errors.otherServiceDescription?.message}
          required
        />
      ) : null}

      {serviceType === "NEW_VISA" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Destination Country" htmlFor="destinationCountryCode" error={errors.destinationCountryCode?.message} required>
            <select
              id="destinationCountryCode"
              defaultValue=""
              className={cn(fieldControlClass, fieldBorderClass(!!errors.destinationCountryCode))}
              {...optionalField("destinationCountryCode")}
            >
              <option value="">{newVisaCountries.length === 0 ? "No New Visa destinations configured" : "Select a country"}</option>
              {newVisaCountries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </FormField>
          {countryProducts.length > 0 ? (
            <FormField label="Visa" htmlFor="newVisaConfigId" hint="Stay duration · Entry type · Visa category." error={errors.newVisaConfigId?.message}>
              <select id="newVisaConfigId" defaultValue="" className={cn(fieldControlClass, fieldBorderClass(!!errors.newVisaConfigId))} {...optionalField("newVisaConfigId")}>
                <option value="">Select the visa</option>
                {countryProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.label}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          {nationalities.length > 0 ? (
            <FormField label="Nationality (as on passport)" htmlFor="nationalityId" hint="Prices can differ by nationality." error={errors.nationalityId?.message}>
              <select id="nationalityId" defaultValue="" className={cn(fieldControlClass, fieldBorderClass(!!errors.nationalityId))} {...optionalField("nationalityId")}>
                <option value="">Select the nationality</option>
                {nationalities.map((nationality) => (
                  <option key={nationality.id} value={nationality.id}>
                    {nationality.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <FormField label="Processing Type" htmlFor="processingType" error={errors.processingType?.message} required>
            <select
              id="processingType"
              defaultValue=""
              className={cn(fieldControlClass, fieldBorderClass(!!errors.processingType))}
              {...optionalField("processingType")}
            >
              <option value="">Select processing type</option>
              {processingOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      ) : null}

      {serviceType === "OTB" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Destination Country" htmlFor="otbDestinationCountryCode" error={errors.destinationCountryCode?.message} required>
            <select
              id="otbDestinationCountryCode"
              defaultValue=""
              className={cn(fieldControlClass, fieldBorderClass(!!errors.destinationCountryCode))}
              {...optionalField("destinationCountryCode")}
            >
              <option value="">{countries.length === 0 ? "No active countries configured" : "Select a country"}</option>
              {countries.map((country) => (
                <option key={country.id} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Airline" htmlFor="airlineCode" error={errors.airlineCode?.message} required>
            <select
              id="airlineCode"
              defaultValue=""
              className={cn(fieldControlClass, fieldBorderClass(!!errors.airlineCode))}
              {...optionalField("airlineCode")}
            >
              <option value="">{airlines.length === 0 ? "No active airlines configured" : "Select an airline"}</option>
              {airlines.map((airline) => (
                <option key={airline.code} value={airline.code}>
                  {airline.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Processing Type" htmlFor="processingType" error={errors.processingType?.message} required>
            <select
              id="processingType"
              defaultValue=""
              className={cn(fieldControlClass, fieldBorderClass(!!errors.processingType))}
              {...optionalField("processingType")}
            >
              <option value="">Select processing type</option>
              {processingOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      ) : null}

      {serviceType === "RETURN_TICKET" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Destination"
            htmlFor="returnTicketDestinationCountryId"
            error={errors.returnTicketDestinationCountryId?.message}
            required
          >
            <select
              id="returnTicketDestinationCountryId"
              defaultValue=""
              className={cn(fieldControlClass, fieldBorderClass(!!errors.returnTicketDestinationCountryId))}
              {...optionalField("returnTicketDestinationCountryId")}
            >
              <option value="">{destinations.length === 0 ? "No active destinations configured" : "Select a destination"}</option>
              {destinations.map((destination) => (
                <option key={destination.countryId} value={destination.countryId}>
                  {destination.countryName}
                </option>
              ))}
            </select>
          </FormField>
          <DateField
            {...register("returnTicketExpectedReturnDate")}
            name="returnTicketExpectedReturnDate"
            label="Expected Return Date"
            error={errors.returnTicketExpectedReturnDate?.message}
            required
          />
        </div>
      ) : null}

      {serviceType === "VISA_EXTENSION" || serviceType === "VISA_CHANGE" ? (
        // Client doc 2026-10-20 (K1) — the form follows the service: the current visa's expiry for VE / VC.
        // Client doc 16 Nov (E3) — the visa may already have expired: past dates are allowed.
        <DateField
          {...register("visaExpiryDate")}
          name="visaExpiryDate"
          label="Visa Expiry Date"
          min="1900-01-01"
          error={errors.visaExpiryDate?.message}
          required
        />
      ) : null}

      {/* Client doc 16 Nov (D5) — Visa Change: exit method + nationality decide the document checklist. */}
      {serviceType === "VISA_CHANGE" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Exit Method" htmlFor="visaChangeMethod" error={errors.visaChangeMethod?.message} required>
            <select id="visaChangeMethod" defaultValue="" className={cn(fieldControlClass, fieldBorderClass(!!errors.visaChangeMethod))} {...register("visaChangeMethod", { setValueAs: (value: string) => value || undefined })}>
              <option value="">Select the exit method</option>
              <option value="AIRPORT_TO_AIRPORT">Airport to Airport (A2A)</option>
              <option value="BORDER_EXIT">By Border</option>
            </select>
          </FormField>
          <FormField label="Nationality (as on passport)" htmlFor="vcNationalityId" hint="Decides the document checklist." error={errors.nationalityId?.message} required>
            <select id="vcNationalityId" defaultValue="" className={cn(fieldControlClass, fieldBorderClass(!!errors.nationalityId))} {...optionalField("nationalityId")}>
              <option value="">Select the nationality</option>
              {nationalities.map((nationality) => (
                <option key={nationality.id} value={nationality.id}>
                  {nationality.name}
                </option>
              ))}
            </select>
          </FormField>
          <p className="text-xs text-ink-tertiary sm:col-span-2">
            Before payment only the visa copy is needed (a slot is added for each passenger); the configured documents follow after payment.
          </p>
        </div>
      ) : null}

      {/* Client doc 16 Nov (E6) — Visa Extension: each passenger's passport number, for staff verification. */}
      {serviceType === "VISA_EXTENSION" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: Math.min(20, Math.max(1, (Number(watch("adultCount")) || 0) + (Number(watch("childCount")) || 0))) }, (_, index) => (
            <TextField
              key={index}
              {...register(`passportNumbers.${index}` as const)}
              name={`passportNumbers.${index}`}
              label={index === 0 ? "Passport Number — Passenger 1" : `Passport Number — Passenger ${index + 1}`}
              error={errors.passportNumbers?.[index]?.message}
              required
            />
          ))}
        </div>
      ) : null}

      {/* Client doc 16 Nov (A1) — Special Fare: departure / arrival (Airport master search, as on the website). */}
      {serviceType === "FLIGHT_SPECIAL_FARE" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AirportSearchField name="flightOrigin" label="Departure City / Airport" required error={errors.flightOrigin?.message} />
          <AirportSearchField name="flightDestination" label="Arrival City / Airport" required error={errors.flightDestination?.message} />
        </div>
      ) : null}

      {/* Client doc 16 Nov (D5 / E6) — Visa Change / Visa Extension don't ask a travel date. */}
      {serviceType === "VISA_EXTENSION" || serviceType === "VISA_CHANGE" ? null : (
        <DateField {...register("travelDate")} name="travelDate" label="Travel Date" error={errors.travelDate?.message} required />
      )}
      {serviceType === "FLIGHT_SPECIAL_FARE" ? (
        <DateField
          {...register("flightReturnDate")}
          name="flightReturnDate"
          label="Return Date (round trip only)"
          hint="Leave empty for a one-way flight."
          error={errors.flightReturnDate?.message}
        />
      ) : null}

      {/* OTB and Return Ticket have one rate for every passenger (client reply 2026-10-13): just a passenger count. */}
      {serviceType === "OTB" || serviceType === "RETURN_TICKET" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField {...numberField("adultCount")} type="number" min={1} name="adultCount" label="Passengers" error={errors.adultCount?.message} required />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Client 2026-10-25 — Special Fare: Adult 12+, Child 2–12, Infant 0–2; every other service: Adult 18+, Child under 18. */}
          <TextField
            {...numberField("adultCount")}
            type="number"
            min={1}
            name="adultCount"
            label={serviceType === "FLIGHT_SPECIAL_FARE" ? "Adults (12+)" : "Adults (18+)"}
            error={errors.adultCount?.message}
            required
          />
          <TextField
            {...numberField("childCount")}
            type="number"
            min={0}
            name="childCount"
            label={serviceType === "FLIGHT_SPECIAL_FARE" ? "Children (2–12)" : "Children (under 18)"}
            error={errors.childCount?.message}
          />
          {serviceType === "FLIGHT_SPECIAL_FARE" && (
            <TextField {...numberField("infantCount")} type="number" min={0} name="infantCount" label="Infants (0–2)" error={errors.infantCount?.message} />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          {...optionalField("couponCode")}
          name="couponCode"
          label="Coupon Code (optional)"
          error={errors.couponCode?.message}
        />
        <TextField
          {...numberField("extraCharges")}
          type="number"
          min={0}
          name="extraCharges"
          label="Extra Charges (optional)"
          error={errors.extraCharges?.message}
        />
      </div>

      {serviceType ? <ManualLeadPricePanel preview={preview} /> : null}

      <div className="flex justify-end">
        <Button type="submit" isLoading={submitting}>
          Create Lead
        </Button>
      </div>
    </form>
    </FormProvider>
  );
}

const rupees = (value: number) => formatRupees(value);

/** Client doc 2026-10-20 (K1) — what the payment link will charge, before the lead is created. */
function ManualLeadPricePanel({ preview }: { preview: ManualLeadPricePreview | null }) {
  if (!preview) return null;
  if (!preview.available) {
    return (
      <p className={cn("rounded-lg px-4 py-3 text-sm", preview.byQuotation ? "bg-surface-2 text-ink-secondary" : "bg-warning/10 text-warning")}>
        {preview.byQuotation ? "This service is priced by a staff quotation — build it on the lead after creating it." : preview.reason}
      </p>
    );
  }
  return (
    <dl className="flex flex-col gap-1.5 rounded-xl border border-hairline bg-surface-2/50 p-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-ink-secondary">Configured amount (Admin)</dt>
        <dd className="font-semibold text-ink-heading">{rupees(preview.configuredAmount)}</dd>
      </div>
      {preview.serviceFee !== null ? (
        <div className="flex justify-between text-xs text-ink-tertiary">
          <dt>of which service fee (GST applies on this)</dt>
          <dd>{rupees(preview.serviceFee)}</dd>
        </div>
      ) : null}
      {preview.extraCharges > 0 ? (
        <div className="flex justify-between">
          <dt className="text-ink-secondary">Extra charges</dt>
          <dd>+ {rupees(preview.extraCharges)}</dd>
        </div>
      ) : null}
      {preview.couponDiscount > 0 ? (
        <div className="flex justify-between text-success">
          <dt>Coupon discount</dt>
          <dd>− {rupees(preview.couponDiscount)}</dd>
        </div>
      ) : null}
      {preview.couponError ? <p className="text-xs text-error">{preview.couponError}</p> : null}
      <div className="flex justify-between border-t border-hairline pt-1.5 text-base font-semibold text-ink-heading">
        <dt>Final payable</dt>
        <dd>{rupees(preview.finalPayable)}</dd>
      </div>
      <p className="text-[11px] text-ink-tertiary">GST and gateway fee, if configured, are added on the payment page.</p>
    </dl>
  );
}
