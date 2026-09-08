"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import type { ReturnTicketRequestValues } from "@/lib/validation/return-ticket-schema";

/**
 * Return_Verified_Ticket.md §5/§10, locked: customer provides name,
 * passenger count, visa type (30/60 days), and travel date only — no
 * destination (UAE-only service, §3) and no return/onward date (§6: that's
 * computed server-side, never customer-entered — see Step2Summary.tsx's
 * comment for why it isn't previewed here either).
 */
export function Step1TripDetails() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ReturnTicketRequestValues>();
  const visaType = useWatch({ control, name: "visaType" });

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
        <TextField
          label="Number of Passengers"
          type="number"
          min={1}
          max={9}
          required
          error={errors.travelers?.message}
          {...register("travelers")}
        />
        <DateField label="Travel Date" required error={errors.travelDate?.message} {...register("travelDate")} />
      </div>

      <RadioCardGroup<ReturnTicketRequestValues>
        name="visaType"
        label="UAE Visa Type"
        required
        register={register}
        selectedValue={visaType}
        error={errors.visaType?.message}
        options={[
          { value: "THIRTY_DAYS", label: "30 Days" },
          { value: "SIXTY_DAYS", label: "60 Days" },
        ]}
      />
    </div>
  );
}
