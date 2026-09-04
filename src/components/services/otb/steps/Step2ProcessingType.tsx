"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import type { OtbRequestValues } from "@/lib/validation/otb-schema";

export function Step2ProcessingType() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<OtbRequestValues>();
  const processingType = useWatch({ control, name: "processingType" });

  return (
    <RadioCardGroup<OtbRequestValues>
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
          description: "Standard processing timeline for your OTB request.",
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
