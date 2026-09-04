"use client";

import { useFormContext } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { DateField } from "@/components/forms/DateField";
import { SAMPLE_AIRLINE_OPTIONS, SAMPLE_DATA_CAPTION } from "@/lib/sample-data";
import type { OtbRequestValues } from "@/lib/validation/otb-schema";

export function Step1BasicDetails() {
  const {
    register,
    formState: { errors },
  } = useFormContext<OtbRequestValues>();

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
      <SelectField
        label="Airline"
        required
        options={SAMPLE_AIRLINE_OPTIONS}
        hint={SAMPLE_DATA_CAPTION}
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
