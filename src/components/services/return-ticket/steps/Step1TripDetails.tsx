"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { SelectField } from "@/components/forms/SelectField";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { RETURN_TICKET_VISA_TYPE_LABELS } from "@/lib/leads/compute-return-date";
import { formatRupees, useReturnTicketDestinations } from "@/lib/return-ticket/use-return-ticket-destinations";
import type { ReturnTicketRequestValues } from "@/lib/validation/return-ticket-schema";

/**
 * Return_Verified_Ticket.md §5/§10: no customer-entered return/onward date
 * (computed server-side). Per the client's update, the destination country,
 * its rate and the visa-validity options come from Admin configuration.
 */
export function Step1TripDetails() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<ReturnTicketRequestValues>();
  const destinationCountryId = useWatch({ control, name: "destinationCountryId" });
  const visaType = useWatch({ control, name: "visaType" });
  const { state, destinations, errorMessage } = useReturnTicketDestinations();

  if (state === "loading") return <Skeleton className="h-64 w-full" />;
  if (state === "error") return <ErrorState title="Couldn't load destinations" description={errorMessage} />;
  if (destinations.length === 0) {
    return (
      <EmptyState
        title="No destinations available yet"
        description="Return Verified Ticket destinations haven't been set up. Please contact us on WhatsApp."
      />
    );
  }

  const selected = destinations.find((d) => d.countryId === destinationCountryId);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField label="Full Name" required error={errors.fullName?.message} {...register("fullName")} />
        <TextField
          label="Mobile Number"
          type="tel"
          required
          placeholder="+91 98765 43210"
          error={errors.mobile?.message}
          {...register("mobile")}
        />
        <TextField
          label="Email"
          type="email"
          required
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField label="Passport Number" required error={errors.passportNumber?.message} {...register("passportNumber")} />
        <SelectField
          label="Destination Country"
          required
          placeholder="Select a country"
          options={destinations.map((d) => ({ value: d.countryId, label: d.countryName }))}
          error={errors.destinationCountryId?.message}
          {...register("destinationCountryId", {
            onChange: () => setValue("visaType", undefined as unknown as ReturnTicketRequestValues["visaType"]),
          })}
        />
        <DateField label="Travel Date" required error={errors.travelDate?.message} {...register("travelDate")} />
      </div>

      {selected ? (
        <>
          <p className="text-sm text-ink-secondary">
            Rate for {selected.countryName}: <strong>{formatRupees(selected.ratePerApplicant)}</strong> per applicant.
          </p>
          <RadioCardGroup<ReturnTicketRequestValues>
            name="visaType"
            label="Visa Validity"
            required
            register={register}
            selectedValue={visaType}
            error={errors.visaType?.message}
            options={selected.validityOptions.map((option) => ({
              value: option,
              label: RETURN_TICKET_VISA_TYPE_LABELS[option],
            }))}
          />
        </>
      ) : null}
    </div>
  );
}
