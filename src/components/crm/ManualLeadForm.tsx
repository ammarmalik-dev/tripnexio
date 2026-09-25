"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { Button } from "@/components/ui/Button";
import { manualLeadSchema, type ManualLeadValues } from "@/lib/validation/manual-lead-schema";
import { RETURN_TICKET_VISA_TYPE_LABELS, type ReturnTicketVisaType } from "@/lib/leads/compute-return-date";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { PaymentLinkAction } from "./PaymentLinkAction";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

interface CountryOption {
  id: string;
  code: string;
  name: string;
}

interface OtbAirlineOption {
  code: string;
  name: string;
  normalPrice: number | null;
  urgentPrice: number | null;
}

interface ReturnTicketDestinationOption {
  countryId: string;
  countryName: string;
  ratePerApplicant: number;
  validityOptions: ReturnTicketVisaType[];
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
  const [airlines, setAirlines] = useState<OtbAirlineOption[]>([]);
  const [destinations, setDestinations] = useState<ReturnTicketDestinationOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ManualLeadResult | null>(null);

  useEffect(() => {
    void getJson<CountryOption[]>("/api/countries").then(setCountries).catch(() => undefined);
    void getJson<OtbAirlineOption[]>("/api/otb/airlines").then(setAirlines).catch(() => undefined);
    void getJson<ReturnTicketDestinationOption[]>("/api/return-ticket/destinations").then(setDestinations).catch(() => undefined);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ManualLeadValues>({
    resolver: zodResolver(manualLeadSchema),
    defaultValues: { adultCount: 1, childCount: 0, infantCount: 0 },
  });

  const serviceType = watch("serviceType");
  const returnTicketDestinationCountryId = watch("returnTicketDestinationCountryId");
  const selectedDestination = destinations.find((d) => d.countryId === returnTicketDestinationCountryId);

  const numberField = (name: "adultCount" | "childCount" | "infantCount" | "extraCharges") =>
    register(name, { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) });
  const optionalField = (name: "email" | "otherServiceDescription" | "couponCode" | "destinationCountryCode" | "airlineCode" | "returnTicketDestinationCountryId" | "processingType" | "returnTicketVisaType") =>
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 rounded-xl border border-hairline bg-surface-1 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField {...register("fullName")} name="fullName" label="Name" error={errors.fullName?.message} required />
        <TextField {...register("mobile")} name="mobile" label="Mobile" error={errors.mobile?.message} required />
        <TextField {...optionalField("email")} name="email" label="Email" error={errors.email?.message} />
        <TextField
          {...register("source")}
          name="source"
          label="Source"
          placeholder="e.g. Phone call, Walk-in, Referral"
          error={errors.source?.message}
          required
        />
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
              <option value="">{countries.length === 0 ? "No active countries configured" : "Select a country"}</option>
              {countries.map((country) => (
                <option key={country.id} value={country.code}>
                  {country.name}
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
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </FormField>
        </div>
      ) : null}

      {serviceType === "OTB" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
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
          <FormField label="Visa Validity" htmlFor="returnTicketVisaType" error={errors.returnTicketVisaType?.message} required>
            <select
              id="returnTicketVisaType"
              defaultValue=""
              className={cn(fieldControlClass, fieldBorderClass(!!errors.returnTicketVisaType))}
              {...optionalField("returnTicketVisaType")}
            >
              <option value="">Select a visa validity</option>
              {(selectedDestination?.validityOptions ?? []).map((visaType) => (
                <option key={visaType} value={visaType}>
                  {RETURN_TICKET_VISA_TYPE_LABELS[visaType]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      ) : null}

      <DateField {...register("travelDate")} name="travelDate" label="Travel Date" error={errors.travelDate?.message} required />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField {...numberField("adultCount")} type="number" min={1} name="adultCount" label="Adults" error={errors.adultCount?.message} required />
        <TextField {...numberField("childCount")} type="number" min={0} name="childCount" label="Children" error={errors.childCount?.message} />
        <TextField {...numberField("infantCount")} type="number" min={0} name="infantCount" label="Infants" error={errors.infantCount?.message} />
      </div>

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

      <div className="flex justify-end">
        <Button type="submit" isLoading={submitting}>
          Create Lead
        </Button>
      </div>
    </form>
  );
}
