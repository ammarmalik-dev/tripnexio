import { z } from "zod";

/**
 * New Visa request validation. Split into per-step schemas so the stepper
 * can validate one step at a time (react-hook-form's `trigger(fieldNames)`),
 * then merged for the final submit payload.
 */

const todayAtMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const newVisaStep1Schema = z.object({
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
  destinationCountry: z.string().min(1, "Select a destination country"),
  visaType: z.string().min(1, "Select a visa type"),
  travelers: z
    .string()
    .trim()
    .regex(/^[1-9]$/, "Enter a number between 1 and 9 (contact us directly for 9+)"),
  travelDate: z
    .string()
    .min(1, "Select a travel date")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date >= todayAtMidnight();
    }, "Travel date must be today or later"),
});

export const newVisaStep2Schema = z.object({
  processingType: z.enum(["normal", "urgent"], {
    error: "Select a processing type",
  }),
});

export const newVisaRequestSchema = newVisaStep1Schema.extend(newVisaStep2Schema.shape);

export type NewVisaStep1Values = z.infer<typeof newVisaStep1Schema>;
export type NewVisaStep2Values = z.infer<typeof newVisaStep2Schema>;
export type NewVisaRequestValues = z.infer<typeof newVisaRequestSchema>;

export const newVisaStepFields: Record<number, (keyof NewVisaRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "destinationCountry", "visaType", "travelers", "travelDate"],
  1: ["processingType"],
  2: [],
};

export const newVisaStepLabels = ["Travel Details", "Processing Type", "Summary"];
