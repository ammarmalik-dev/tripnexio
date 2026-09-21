import { z } from "zod";
import { isMinor } from "@/lib/leads/age";

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

export const GUARDIAN_RELATIONSHIPS = ["FATHER", "MOTHER", "LEGAL_GUARDIAN"] as const;
export const GUARDIAN_RELATIONSHIP_LABELS: Record<(typeof GUARDIAN_RELATIONSHIPS)[number], string> = {
  FATHER: "Father",
  MOTHER: "Mother",
  LEGAL_GUARDIAN: "Legal guardian",
};
export const MAX_ADDITIONAL_TRAVELLERS = 8;

const passportNumberField = z
  .string()
  .trim()
  .min(4, "Enter the passport number")
  .max(20, "Passport number is too long")
  .transform((value) => value.toUpperCase());

/**
 * Per-traveller details (client's New Visa handover): passport number, date of
 * birth and occupation for everyone; a minor (under 18) also needs guardian
 * details. The guardian fields and the passport copy are optional in the
 * schema and enforced by `findNewVisaTravellerIssues` (the form's
 * extraStepValidation, and again server-side) because whether they're
 * required depends on the traveller's date of birth.
 */
const travellerDetailFields = {
  passportNumber: passportNumberField,
  dob: z
    .string()
    .min(1, "Select the date of birth")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date of birth"),
  occupation: z.string().trim().min(1, "Select an occupation"),
  guardianFullName: z.string().trim().optional(),
  guardianPassportNumber: z.string().trim().optional(),
  guardianRelationship: z.enum(GUARDIAN_RELATIONSHIPS).optional(),
};

export const newVisaAdditionalTravellerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the traveller's full name").max(80, "Name is too long"),
  ...travellerDetailFields,
  passportImageBase64: z.string().optional(),
  passportImageMimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]).optional(),
});

/** The primary traveller's own details (their name/contact come from step 1; their passport copy uses newVisaStep3Schema's existing fields). */
export const newVisaTravellersSchema = z.object({
  ...travellerDetailFields,
  additionalTravellers: z.array(newVisaAdditionalTravellerSchema).max(MAX_ADDITIONAL_TRAVELLERS),
});

export const newVisaRequestSchema = newVisaStep1Schema
  .extend(newVisaStep2Schema.shape)
  .extend(newVisaStep3Schema.shape)
  .extend(newVisaTravellersSchema.shape);

interface TravellerForCheck {
  dob?: string;
  guardianFullName?: string;
  guardianPassportNumber?: string;
  guardianRelationship?: string;
  passportImageBase64?: string;
}

/**
 * Cross-field rules the per-field schema can't express: every traveller needs
 * a passport copy, and a traveller under 18 needs guardian details. Returned
 * as `path` + message issues (primary first, then additional travellers in
 * order) — used by the form's extraStepValidation and by the API route.
 */
export function findNewVisaTravellerIssues(values: TravellerForCheck & { additionalTravellers: TravellerForCheck[] }) {
  const issues: { path: string; message: string }[] = [];
  const check = (traveller: TravellerForCheck, prefix: string) => {
    if (!traveller.passportImageBase64) issues.push({ path: `${prefix}passportImageBase64`, message: "Upload a copy of the passport" });
    if (isMinor(traveller.dob)) {
      if (!traveller.guardianFullName || traveller.guardianFullName.trim().length < 2) {
        issues.push({ path: `${prefix}guardianFullName`, message: "Enter the guardian's full name" });
      }
      if (!traveller.guardianPassportNumber || traveller.guardianPassportNumber.trim().length < 4) {
        issues.push({ path: `${prefix}guardianPassportNumber`, message: "Enter the guardian's passport number" });
      }
      if (!traveller.guardianRelationship) {
        issues.push({ path: `${prefix}guardianRelationship`, message: "Select the relationship" });
      }
    }
  };
  check(values, "");
  values.additionalTravellers.forEach((traveller, index) => check(traveller, `additionalTravellers.${index}.`));
  return issues;
}

export type NewVisaStep1Values = z.infer<typeof newVisaStep1Schema>;
export type NewVisaStep2Values = z.infer<typeof newVisaStep2Schema>;
export type NewVisaRequestValues = z.infer<typeof newVisaRequestSchema>;

export const newVisaStepFields: Record<number, (keyof NewVisaRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "destinationCountry", "visaType", "travelDate"],
  1: ["passportNumber", "dob", "occupation", "additionalTravellers"],
  2: ["processingType"],
  3: [],
};

export const newVisaStepLabels = ["Travel Details", "Travellers", "Processing Type", "Summary"];
