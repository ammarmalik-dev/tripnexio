"use client";

import { useFormContext, useFieldArray, type UseFormRegisterReturn } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SearchableSelectField } from "@/components/forms/SearchableSelectField";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useNationalities } from "@/lib/use-nationalities";
import { MAX_ADDITIONAL_PASSENGERS, type VisaChangeRequestValues } from "@/lib/validation/visa-change-schema";

// Visa last date can legitimately be in the past (already expired) or
// future (still valid) — override DateField's default min=today.
const MIN_VISA_LAST_DATE = "1900-01-01";

function PaxTypeSelect({ id, error, registration }: { id: string; error?: string; registration: UseFormRegisterReturn }) {
  return (
    <FormField label="Adult / Child" htmlFor={id} error={error} required>
      <select id={id} className={cn(fieldControlClass, fieldBorderClass(!!error))} {...registration}>
        <option value="ADULT">Adult</option>
        <option value="CHILD">Child</option>
      </select>
    </FormField>
  );
}

/** Visa_Change.md §3: buyer details, then "+ Add Another Passenger" for each additional passenger. */
export function Step2Details() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<VisaChangeRequestValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "additionalPassengers" });
  const { options: nationalities } = useNationalities();
  const nationalityOptions = nationalities.map((nationality) => ({ value: nationality.id, label: nationality.name }));
  const atLimit = fields.length >= MAX_ADDITIONAL_PASSENGERS;

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
        <SearchableSelectField
          name="nationalityId"
          label="Nationality"
          required
          options={nationalityOptions}
          error={errors.nationalityId?.message}
        />
        <PaxTypeSelect id="paxType" error={errors.paxType?.message} registration={register("paxType")} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-heading">Additional Passengers</h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={atLimit}
            onClick={() => append({ fullName: "", passportNumber: "", visaLastDate: "", nationalityId: "", paxType: "ADULT" })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Another Passenger
          </Button>
        </div>

        {atLimit ? (
          <p className="text-xs text-ink-tertiary">
            You can add up to {MAX_ADDITIONAL_PASSENGERS} more passengers. Contact us on WhatsApp for larger groups.
          </p>
        ) : null}
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
                <SearchableSelectField
                  name={`additionalPassengers.${index}.nationalityId`}
                  label="Nationality"
                  required
                  options={nationalityOptions}
                  error={errors.additionalPassengers?.[index]?.nationalityId?.message}
                />
                <PaxTypeSelect
                  id={`additionalPassengers.${index}.paxType`}
                  error={errors.additionalPassengers?.[index]?.paxType?.message}
                  registration={register(`additionalPassengers.${index}.paxType` as const)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
