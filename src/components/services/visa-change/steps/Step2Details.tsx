"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { VisaChangeRequestValues } from "@/lib/validation/visa-change-schema";

// Visa last date can legitimately be in the past (already expired) or
// future (still valid) — override DateField's default min=today.
const MIN_VISA_LAST_DATE = "1900-01-01";

/** Visa_Change.md §3: buyer details, then "+ Add Another Passenger" for each additional passenger. */
export function Step2Details() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<VisaChangeRequestValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "additionalPassengers" });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField label="Full Name" required error={errors.fullName?.message} {...register("fullName")} />
        <TextField
          label="Passport Number"
          required
          error={errors.passportNumber?.message}
          {...register("passportNumber")}
        />
        <DateField
          label="Visa Last Date"
          required
          min={MIN_VISA_LAST_DATE}
          hint="The expiry date on your current visa."
          error={errors.visaLastDate?.message}
          {...register("visaLastDate")}
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
        <TextField label="Nationality" required error={errors.nationality?.message} {...register("nationality")} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-heading">Additional Passengers</h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => append({ fullName: "", passportNumber: "", visaLastDate: "", nationality: "", paxType: "ADULT" })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Another Passenger
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-xs text-ink-tertiary">Add anyone else whose visa needs to be changed along with yours.</p>
        ) : (
          fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium tracking-wide text-ink-tertiary uppercase">Passenger {index + 2}</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Full Name"
                  required
                  error={errors.additionalPassengers?.[index]?.fullName?.message}
                  {...register(`additionalPassengers.${index}.fullName` as const)}
                />
                <TextField
                  label="Passport Number"
                  required
                  error={errors.additionalPassengers?.[index]?.passportNumber?.message}
                  {...register(`additionalPassengers.${index}.passportNumber` as const)}
                />
                <DateField
                  label="Visa Last Date"
                  required
                  min={MIN_VISA_LAST_DATE}
                  error={errors.additionalPassengers?.[index]?.visaLastDate?.message}
                  {...register(`additionalPassengers.${index}.visaLastDate` as const)}
                />
                <TextField
                  label="Nationality"
                  required
                  error={errors.additionalPassengers?.[index]?.nationality?.message}
                  {...register(`additionalPassengers.${index}.nationality` as const)}
                />
                <FormField
                  label="Adult / Child"
                  htmlFor={`additionalPassengers.${index}.paxType`}
                  error={errors.additionalPassengers?.[index]?.paxType?.message}
                >
                  <select
                    id={`additionalPassengers.${index}.paxType`}
                    className={cn(fieldControlClass, fieldBorderClass(!!errors.additionalPassengers?.[index]?.paxType))}
                    {...register(`additionalPassengers.${index}.paxType` as const)}
                  >
                    <option value="ADULT">Adult</option>
                    <option value="CHILD">Child</option>
                  </select>
                </FormField>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
