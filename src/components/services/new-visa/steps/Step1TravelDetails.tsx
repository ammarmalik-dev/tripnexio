"use client";

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { DateField } from "@/components/forms/DateField";
import { useDestinationCountryOptions } from "@/lib/use-destination-countries";
import { useVisaTypes } from "@/lib/use-visa-types";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

export function Step1TravelDetails() {
  const {
    register,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useFormContext<NewVisaRequestValues>();
  const destinationCountryOptions = useDestinationCountryOptions();
  const destinationCountry = useWatch({ control, name: "destinationCountry" });
  const { options: visaTypes, loading: visaTypesLoading } = useVisaTypes(destinationCountry);

  // Admin-managed per destination: required only when this destination has
  // options, and a pick from another destination's list is cleared.
  useEffect(() => {
    if (visaTypesLoading) return;
    setValue("visaTypeRequired", visaTypes.length > 0);
    const current = getValues("visaType");
    if (current && !visaTypes.some((visaType) => visaType.id === current)) setValue("visaType", "");
  }, [visaTypes, visaTypesLoading, setValue, getValues]);

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
      {visaTypes.length > 0 ? (
        <SelectField
          label="Visa Type"
          required
          options={visaTypes.map((visaType) => ({ value: visaType.id, label: visaType.name }))}
          error={errors.visaType?.message}
          {...register("visaType")}
        />
      ) : null}
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
