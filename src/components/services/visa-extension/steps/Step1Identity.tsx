"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { DateField } from "@/components/forms/DateField";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { PassportUploadField } from "@/components/forms/PassportUploadField";
import type { VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";

const MIN_DOB = "1900-01-01";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function Step1Identity() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<VisaExtensionRequestValues>();
  const insideUAE = useWatch({ control, name: "insideUAE" });

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
          hint="We use this to check for a visa originally issued through TripNexio."
          error={errors.passportNumber?.message}
          {...register("passportNumber")}
        />
        <DateField
          label="Date of Birth"
          required
          min={MIN_DOB}
          max={todayIso()}
          error={errors.dob?.message}
          {...register("dob")}
        />
      </div>
      <RadioCardGroup<VisaExtensionRequestValues>
        name="insideUAE"
        label="Are you currently inside the UAE?"
        required
        register={register}
        selectedValue={insideUAE}
        error={errors.insideUAE?.message}
        options={[
          { value: "yes", label: "Yes", description: "I'm currently inside the UAE." },
          { value: "no", label: "No", description: "I'm currently outside the UAE." },
        ]}
      />
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
