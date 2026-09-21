"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import {
  MAX_ADDITIONAL_RETURN_TICKET_APPLICANTS,
  type ReturnTicketRequestValues,
} from "@/lib/validation/return-ticket-schema";

/** Secondary applicants only need Full Name + Passport Number — mobile/email come from the primary applicant. */
export function Step2Applicants() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ReturnTicketRequestValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "additionalApplicants" });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-secondary">
        Booking for more than one person? Add each additional applicant below, or skip this step if it&apos;s only you.
      </p>

      {fields.map((field, index) => {
        const applicantErrors = errors.additionalApplicants?.[index];
        return (
          <fieldset key={field.id} className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold text-ink-heading">Applicant {index + 2}</legend>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Full Name"
                required
                error={applicantErrors?.fullName?.message}
                {...register(`additionalApplicants.${index}.fullName` as const)}
              />
              <TextField
                label="Passport Number"
                required
                error={applicantErrors?.passportNumber?.message}
                {...register(`additionalApplicants.${index}.passportNumber` as const)}
              />
            </div>
          </fieldset>
        );
      })}

      {fields.length < MAX_ADDITIONAL_RETURN_TICKET_APPLICANTS ? (
        <Button type="button" variant="glass" onClick={() => append({ fullName: "", passportNumber: "" })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Applicant
        </Button>
      ) : null}
    </div>
  );
}
