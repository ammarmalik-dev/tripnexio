"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { PassportUploadField } from "@/components/forms/PassportUploadField";
import { Button } from "@/components/ui/Button";
import { MAX_ADDITIONAL_APPLICANTS, type VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";

const MIN_DATE = "1900-01-01";
const MAX_DATE = "2100-12-31";

/**
 * Optional step — extending for more than one person. Each additional
 * applicant gets their own details and their own passport-copy upload, all
 * collected before the Lead exists. Mobile/email aren't asked again: they're
 * already captured from the primary applicant.
 */
export function Step2Applicants() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<VisaExtensionRequestValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "additionalApplicants" });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-secondary">
        Extending for anyone else travelling with you? Add each person below — you&apos;ll upload their documents
        here too. Skip this step if it&apos;s only you.
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
              <DateField
                label="Visa Expiry Date"
                required
                min={MIN_DATE}
                max={MAX_DATE}
                error={applicantErrors?.visaExpiryDate?.message}
                {...register(`additionalApplicants.${index}.visaExpiryDate` as const)}
              />
            </div>
            <PassportUploadField
              base64FieldName={`additionalApplicants.${index}.passportImageBase64`}
              mimeFieldName={`additionalApplicants.${index}.passportImageMimeType`}
              label={`Passport copy — Applicant ${index + 2}`}
              description="Upload a clear photo of this applicant's passport main page."
              required
              error={applicantErrors?.passportImageBase64?.message ?? applicantErrors?.passportImageMimeType?.message}
            />
            <PassportUploadField
              base64FieldName={`additionalApplicants.${index}.visaImageBase64`}
              mimeFieldName={`additionalApplicants.${index}.visaImageMimeType`}
              label={`Visa copy — Applicant ${index + 2}`}
              description="Upload a clear photo of this applicant's current visa page."
              required
              error={applicantErrors?.visaImageBase64?.message ?? applicantErrors?.visaImageMimeType?.message}
            />
          </fieldset>
        );
      })}

      {fields.length < MAX_ADDITIONAL_APPLICANTS ? (
        <Button
          type="button"
          variant="glass"
          onClick={() =>
            append({
              fullName: "",
              passportNumber: "",
              visaExpiryDate: "",
              passportImageBase64: "",
              passportImageMimeType: undefined as unknown as "image/jpeg",
              visaImageBase64: "",
              visaImageMimeType: undefined as unknown as "image/jpeg",
            })
          }
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Applicant
        </Button>
      ) : null}
    </div>
  );
}
