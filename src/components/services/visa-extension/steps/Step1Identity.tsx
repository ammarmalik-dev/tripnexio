"use client";

import { useFormContext } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { PassportUploadField } from "@/components/forms/PassportUploadField";
import type { VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";

const MIN_DATE = "1900-01-01";
const MAX_DATE = "2100-12-31";

export function Step1Identity() {
  const {
    register,
    formState: { errors },
  } = useFormContext<VisaExtensionRequestValues>();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField label="Full Name" required error={errors.fullName?.message} {...register("fullName")} />
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
        <TextField
          label="Passport Number"
          required
          hint="We use this to check your visa history with TripNexio."
          error={errors.passportNumber?.message}
          {...register("passportNumber")}
        />
        <DateField
          label="Visa Expiry Date"
          required
          min={MIN_DATE}
          max={MAX_DATE}
          error={errors.visaExpiryDate?.message}
          {...register("visaExpiryDate")}
        />
      </div>
      <PassportUploadField
        base64FieldName="passportImageBase64"
        mimeFieldName="passportImageMimeType"
        label="Passport copy"
        description="Upload a clear photo of your passport's main page. It's attached to your request so our team can validate it right away."
        required
        error={errors.passportImageBase64?.message ?? errors.passportImageMimeType?.message}
      />
    </div>
  );
}
