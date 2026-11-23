"use client";

import { useFormContext } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";
import { TravellerFields } from "./StepTravellers";

/** Basic Details (client doc 2026-10-15: after the visa details, then straight to Applicant Details). */
export function StepBasicDetails() {
  const {
    register,
    formState: { errors },
  } = useFormContext<NewVisaRequestValues>();

  // Client doc 16 Nov (F1) — contact details and the first applicant on one page (kept for an abandoned application).
  return (
    <div className="flex flex-col gap-5">
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <TextField label="Full Name" required error={errors.fullName?.message} {...register("fullName")} />
      <TextField label="Mobile Number" type="tel" required placeholder="+91 98765 43210" error={errors.mobile?.message} {...register("mobile")} />
      {/* Client 2026-10-28 — the odd last field spans the row, so the form never looks left-shifted. */}
      <div className="sm:col-span-2">
        <TextField label="Email" type="email" required placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
      </div>
    </div>
    <TravellerFields prefix="" label="First Applicant" />
    </div>
  );
}
