"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import type { VisaChangeRequestValues } from "@/lib/validation/visa-change-schema";

/**
 * Visa_Change.md §2/§4/§7, Locked Rules #1/#2/#3: the customer only picks
 * the METHOD here — never a specific airport or border name. Staff picks
 * the actual airport/border later from the Admin master once availability
 * is confirmed.
 */
export function Step1Method() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<VisaChangeRequestValues>();
  const changeType = useWatch({ control, name: "changeType" });

  return (
    <RadioCardGroup<VisaChangeRequestValues>
      name="changeType"
      label="Choose Visa Change Method"
      required
      register={register}
      selectedValue={changeType}
      error={errors.changeType?.message}
      options={[
        {
          value: "AIRPORT_TO_AIRPORT",
          label: "Airport to Airport",
          description: "Exit and re-enter via a UAE/GCC airport confirmed by our team.",
        },
        {
          value: "BORDER_EXIT",
          label: "Border Exit",
          description: "Exit via a land border crossing confirmed by our team.",
        },
      ]}
    />
  );
}
