"use client";

import { useFormContext } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { DateField } from "@/components/forms/DateField";
import {
  SAMPLE_VISA_TYPE_OPTIONS,
  SAMPLE_VISA_TYPE_CAPTION,
} from "@/lib/sample-data";
import { useDestinationCountryOptions } from "@/lib/use-destination-countries";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

export function Step1TravelDetails() {
  const {
    register,
    formState: { errors },
  } = useFormContext<NewVisaRequestValues>();
  const destinationCountryOptions = useDestinationCountryOptions();

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
        label="Destination Country"
        required
        options={destinationCountryOptions}
        error={errors.destinationCountry?.message}
        {...register("destinationCountry")}
      />
      <SelectField
        label="Visa Type"
        required
        options={SAMPLE_VISA_TYPE_OPTIONS}
        hint={SAMPLE_VISA_TYPE_CAPTION}
        error={errors.visaType?.message}
        {...register("visaType")}
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
