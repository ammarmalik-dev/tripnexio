"use client";

import { useFormContext } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

/** Basic Details (client doc 2026-10-15: after the visa details, then straight to Applicant Details). */
export function StepBasicDetails() {
  const {
    register,
    formState: { errors },
  } = useFormContext<NewVisaRequestValues>();

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <TextField label="Full Name" required error={errors.fullName?.message} {...register("fullName")} />
      <TextField label="Mobile Number" type="tel" required placeholder="+91 98765 43210" error={errors.mobile?.message} {...register("mobile")} />
      {/* Client 2026-10-28 — the odd last field spans the row, so the form never looks left-shifted. */}
      <div className="sm:col-span-2">
        <TextField label="Email" type="email" required placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
      </div>
    </div>
  );
}
