"use client";

import { useFormContext } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { DateField } from "@/components/forms/DateField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useOtbAirlines } from "@/lib/otb/use-otb-airlines";
import type { OtbRequestValues } from "@/lib/validation/otb-schema";

export function Step1BasicDetails() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OtbRequestValues>();
  const { state, airlines } = useOtbAirlines();

  if (state === "loading") return <Skeleton className="h-64 w-full" />;
  if (airlines.length === 0) {
    return (
      <EmptyState
        title="No airlines available yet"
        description="OTB airlines haven't been set up. Please contact us on WhatsApp."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <TextField
        label="Full Name"
        required
        error={errors.fullName?.message}
        {...register("fullName")}
      />
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
        label="Passport Number"
        required
        error={errors.passportNumber?.message}
        {...register("passportNumber")}
      />
      <SelectField
        label="Airline"
        required
        options={airlines.map((airline) => ({ value: airline.code, label: airline.name }))}
        error={errors.airline?.message}
        {...register("airline")}
      />
      <div className="sm:col-span-2">
        <DateField
          label="Travel Date"
          required
          error={errors.travelDate?.message}
          {...register("travelDate")}
        />
      </div>
    </div>
  );
}
