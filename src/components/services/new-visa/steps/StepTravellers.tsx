"use client";

import { get, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { PassportUploadField } from "@/components/forms/PassportUploadField";
import { Button } from "@/components/ui/Button";
import { isMinor } from "@/lib/leads/age";
import { useOccupations } from "@/lib/use-occupations";
import { cn } from "@/lib/cn";
import {
  GUARDIAN_RELATIONSHIPS,
  GUARDIAN_RELATIONSHIP_LABELS,
  MAX_ADDITIONAL_TRAVELLERS,
  type NewVisaRequestValues,
} from "@/lib/validation/new-visa-schema";

const MIN_DOB = "1900-01-01";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One traveller's fields. `prefix` is "" for the primary traveller (whose
 * name/contact were entered on step 1) or `additionalTravellers.N.` for the
 * others. A traveller under 18 is a minor: they must apply with a parent or
 * guardian, so guardian details appear (client's New Visa handover).
 */
function TravellerFields({ prefix, label, nameField }: { prefix: string; label: string; nameField?: string }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext();
  const { options: occupations, loading } = useOccupations();
  const dob = useWatch({ control, name: `${prefix}dob` }) as string | undefined;
  const minor = isMinor(dob);
  const err = (field: string) => (get(errors, `${prefix}${field}`)?.message as string | undefined) ?? undefined;
  const occupationId = `${prefix}occupation`.replace(/[^a-zA-Z0-9]/g, "-");

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <legend className="px-1 text-sm font-semibold text-ink-heading">{label}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {nameField ? <TextField label="Full Name" required error={err("fullName")} {...register(nameField)} /> : null}
        <TextField label="Passport Number" required error={err("passportNumber")} {...register(`${prefix}passportNumber`)} />
        <DateField
          label="Date of Birth"
          required
          min={MIN_DOB}
          max={todayIso()}
          error={err("dob")}
          {...register(`${prefix}dob`)}
        />
        <FormField label="Occupation" htmlFor={occupationId} error={err("occupation")} required>
          <select
            id={occupationId}
            defaultValue=""
            className={cn(fieldControlClass, fieldBorderClass(!!err("occupation")))}
            {...register(`${prefix}occupation`)}
          >
            <option value="" disabled>
              {loading ? "Loading..." : "Select an occupation"}
            </option>
            {occupations.map((occupation) => (
              <option key={occupation.id} value={occupation.name}>
                {occupation.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {minor ? (
        <div className="flex flex-col gap-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-semibold text-ink-heading">Apply with Parent/Guardian.</p>
          <p className="text-xs text-ink-secondary">This traveller is under 18, so a parent or guardian&apos;s details are needed.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Guardian Full Name" required error={err("guardianFullName")} {...register(`${prefix}guardianFullName`)} />
            <TextField
              label="Guardian Passport Number"
              required
              error={err("guardianPassportNumber")}
              {...register(`${prefix}guardianPassportNumber`)}
            />
            <FormField label="Relationship with the minor" htmlFor={`${occupationId}-relationship`} error={err("guardianRelationship")} required>
              <select
                id={`${occupationId}-relationship`}
                defaultValue=""
                className={cn(fieldControlClass, fieldBorderClass(!!err("guardianRelationship")))}
                {...register(`${prefix}guardianRelationship`)}
              >
                <option value="" disabled>
                  Select relationship
                </option>
                {GUARDIAN_RELATIONSHIPS.map((value) => (
                  <option key={value} value={value}>
                    {GUARDIAN_RELATIONSHIP_LABELS[value]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      ) : null}

      <PassportUploadField
        base64FieldName={`${prefix}passportImageBase64`}
        mimeFieldName={`${prefix}passportImageMimeType`}
        label="Passport copy"
        description="Upload a clear photo of the passport main page."
        required
        error={err("passportImageBase64")}
      />
    </fieldset>
  );
}

/** Step 2: everyone travelling — the primary applicant (name from step 1) plus any additional travellers. */
export function StepTravellers() {
  const { control } = useFormContext<NewVisaRequestValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "additionalTravellers" });
  const primaryName = useWatch({ control, name: "fullName" });

  return (
    <div className="flex flex-col gap-5">
      <TravellerFields prefix="" label={`Traveller 1 — ${primaryName || "you"}`} />

      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove traveller {index + 2}
            </Button>
          </div>
          <TravellerFields
            prefix={`additionalTravellers.${index}.`}
            label={`Traveller ${index + 2}`}
            nameField={`additionalTravellers.${index}.fullName`}
          />
        </div>
      ))}

      {fields.length < MAX_ADDITIONAL_TRAVELLERS ? (
        <Button
          type="button"
          variant="glass"
          onClick={() =>
            append({
              fullName: "",
              passportNumber: "",
              dob: "",
              occupation: "",
              passportImageBase64: "",
            })
          }
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Another Traveller
        </Button>
      ) : null}
    </div>
  );
}
