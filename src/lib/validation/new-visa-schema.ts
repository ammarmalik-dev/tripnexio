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

/**
 * Optional passport-photo upload (Phase 5D — OCR autofill) — see
 * otb-schema.ts's identical field for the full rationale. Also carries the
 * optional Protection Plan interest expression (Step 20, audit §7.1) —
 * New_Visa.md §8's "before purchase... customer must agree" applies to the
 * ACTUAL purchase, which only happens later once a real Booking exists
 * (staff completes it in the CRM); this captures the customer's expressed
 * interest + terms acknowledgement at intake time as a hint for staff, not
 * a completed purchase — see the customer-flow route's own comment.
 */
export const newVisaStep3Schema = z.object({
  passportImageBase64: z.string().optional(),
  passportImageMimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]).optional(),
  // Cross-field "must accept terms to express interest" is enforced by the
  // UI itself (the interest checkbox stays unchecked until terms are
  // accepted), not a zod .refine() here — a refine()-wrapped schema loses
  // its `.shape`, which both newVisaRequestSchema's `.extend()` below and
  // the WhatsApp bot's per-field schema lookups (flows.ts) rely on. Same
  // gotcha already documented for returnTicketRequestSchema. Plain
  // `z.boolean()`, no `.default()` — MultiStepRequestFlow's generic typing
  // needs Input=Output (ZodType<T,T>); `.default()` makes Input
  // `boolean | undefined`, breaking that. The actual default lives in
  // NewVisaRequestFlow's own `defaultValues` instead, same fix already
  // applied to every other field in this project's flows.
  protectionPlanInterested: z.boolean(),
  protectionPlanTermsAccepted: z.boolean(),
});

export const newVisaRequestSchema = newVisaStep1Schema.extend(newVisaStep2Schema.shape).extend(newVisaStep3Schema.shape);

export type NewVisaStep1Values = z.infer<typeof newVisaStep1Schema>;
export type NewVisaStep2Values = z.infer<typeof newVisaStep2Schema>;
export type NewVisaRequestValues = z.infer<typeof newVisaRequestSchema>;

export const newVisaStepFields: Record<number, (keyof NewVisaRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "destinationCountry", "visaType", "travelers", "travelDate"],
  1: ["processingType"],
  2: [],
};

export const newVisaStepLabels = ["Travel Details", "Processing Type", "Summary"];
