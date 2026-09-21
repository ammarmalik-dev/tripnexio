import { z } from "zod";

/**
 * OTB (Ok to Board) request validation. No nationality field per business
 * rule — do not add one. Split into per-step schemas so the stepper can
 * validate one step at a time (react-hook-form's `trigger(fieldNames)`),
 * then merged for the final submit payload.
 */

const todayAtMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const otbStep1Schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(80, "Full name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  airline: z.string().min(1, "Select an airline"),
  travelDate: z
    .string()
    .min(1, "Select a travel date")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date >= todayAtMidnight();
    }, "Travel date must be today or later"),
});

export const otbStep2Schema = z.object({
  processingType: z.enum(["normal", "urgent"], {
    error: "Select a processing type",
  }),
});

/**
 * Optional passport-photo upload (Phase 5D — OCR autofill). Genuinely
 * optional: omitting it just skips the OCR step entirely, never blocks
 * submission — see PassportUploadField.tsx and src/lib/ocr/.
 */
export const otbStep3Schema = z.object({
  passportImageBase64: z.string().optional(),
  passportImageMimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]).optional(),
});

export const MAX_ADDITIONAL_OTB_APPLICANTS = 8;

const passportNumberField = z
  .string()
  .trim()
  .min(4, "Enter the passport number")
  .max(20, "Passport number is too long")
  .transform((value) => value.toUpperCase());

/** Client handover: the primary applicant also gives a passport number; additional applicants give only name + passport number. */
export const otbApplicantsSchema = z.object({
  passportNumber: passportNumberField,
  additionalApplicants: z
    .array(
      z.object({
        fullName: z.string().trim().min(2, "Enter the full name").max(80, "Full name is too long"),
        passportNumber: passportNumberField,
      })
    )
    .max(MAX_ADDITIONAL_OTB_APPLICANTS),
});

/**
 * Return-ticket cross-sell: OTB is only granted with a return ticket. A
 * customer without one still submits (staff follow up and offer the Return
 * Verified Ticket service), so this never blocks — it's captured on the Lead.
 */
export const otbReturnTicketSchema = z.object({
  hasReturnTicket: z.enum(["yes", "no"], { error: "Tell us whether you have a return ticket" }),
});

export const otbRequestSchema = otbStep1Schema
  .extend(otbStep2Schema.shape)
  .extend(otbStep3Schema.shape)
  .extend(otbApplicantsSchema.shape)
  .extend(otbReturnTicketSchema.shape);

export type OtbStep1Values = z.infer<typeof otbStep1Schema>;
export type OtbStep2Values = z.infer<typeof otbStep2Schema>;
export type OtbRequestValues = z.infer<typeof otbRequestSchema>;

export const otbStepFields: Record<number, (keyof OtbRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "passportNumber", "airline", "travelDate"],
  1: ["additionalApplicants"],
  2: ["processingType"],
  3: ["hasReturnTicket"],
};

export const otbStepLabels = ["Basic Details", "Other Applicants", "Processing Type", "Summary"];
