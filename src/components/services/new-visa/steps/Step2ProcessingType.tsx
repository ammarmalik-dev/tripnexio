"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

export function Step2ProcessingType() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<NewVisaRequestValues>();
  const processingType = useWatch({ control, name: "processingType" });

  return (
    <RadioCardGroup<NewVisaRequestValues>
      name="processingType"
      label="Processing Type"
      required
      register={register}
      selectedValue={processingType}
      error={errors.processingType?.message}
      options={[
        {
          value: "normal",
          label: "Normal",
          description: "Standard processing timeline for your visa request.",
        },
        {
          value: "urgent",
          label: "Urgent",
          description: "Expedited processing for time-sensitive travel.",
        },
      ]}
    />
  );
}
