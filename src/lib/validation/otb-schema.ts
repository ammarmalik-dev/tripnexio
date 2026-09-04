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

export const otbRequestSchema = otbStep1Schema.extend(otbStep2Schema.shape);

export type OtbStep1Values = z.infer<typeof otbStep1Schema>;
export type OtbStep2Values = z.infer<typeof otbStep2Schema>;
export type OtbRequestValues = z.infer<typeof otbRequestSchema>;

export const otbStepFields: Record<number, (keyof OtbRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "airline", "travelDate"],
  1: ["processingType"],
  2: [],
};

export const otbStepLabels = ["Basic Details", "Processing Type", "Summary"];
