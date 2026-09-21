import { z } from "zod";

/**
 * Visa Extension request validation — rewritten against the real locked
 * spec (client-message/Visa_Extension.md), replacing the earlier
 * placeholder shape (which had destinationCountry/processingType fields
 * that this service doesn't actually use — Extension scope is UAE-only,
 * §1, and there's no staff-facing "processing type" selection anywhere in
 * the spec, unlike OTB).
 *
 * §2/§25: eligibility is gated on a prior TripNexio-issued visa, looked up
 * server-side by passportNumber+dob (new/unknown customer path) or mobile
 * (existing customer path) — see src/lib/leads/visa-extension-eligibility.ts.
 * `insideUAE` drives the no-match redirect (§2, §25): inside UAE -> Visa
 * Change, outside UAE -> New Visa.
 * §4: Entry Date is mandatory for every request, no exceptions.
 */

export const MAX_ADDITIONAL_APPLICANTS = 5;

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

const passportImageFields = {
  passportImageBase64: z.string().min(1, "Upload a copy of the passport"),
  passportImageMimeType: z.enum(IMAGE_MIME_TYPES, { error: "Upload a copy of the passport" }),
};

const todayAtMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const visaExtensionStep1Schema = z.object({
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
  passportNumber: z
    .string()
    .trim()
    .min(4, "Enter your passport number")
    .max(20, "Passport number is too long")
    .transform((value) => value.toUpperCase()),
  dob: z
    .string()
    .min(1, "Select your date of birth")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date of birth"),
  insideUAE: z.enum(["yes", "no"], { error: "Let us know if you're currently inside the UAE" }),
  ...passportImageFields,
});

export const visaExtensionStep2Schema = z.object({
  /// Mandatory per the locked spec §4 — not `.optional()`.
  entryDate: z
    .string()
    .min(1, "Entry date is required")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date <= todayAtMidnight();
    }, "Entry date can't be in the future"),
});

/**
 * Additional applicants (Visa Extension handover doc): same identity details
 * as the primary applicant minus mobile/email (already captured from the
 * primary), plus their own passport copy — all before the Lead is created.
 * `dob` is required because eligibility is checked per applicant by
 * passport + DOB; `entryDate` follows the locked spec §4.
 */
export const additionalApplicantSchema = z.object({
  fullName: visaExtensionStep1Schema.shape.fullName,
  passportNumber: visaExtensionStep1Schema.shape.passportNumber,
  dob: visaExtensionStep1Schema.shape.dob,
  entryDate: visaExtensionStep2Schema.shape.entryDate,
  ...passportImageFields,
});

export const visaExtensionStep3Schema = z.object({
  additionalApplicants: z.array(additionalApplicantSchema).max(MAX_ADDITIONAL_APPLICANTS),
});

export const visaExtensionRequestSchema = visaExtensionStep1Schema
  .extend(visaExtensionStep2Schema.shape)
  .extend(visaExtensionStep3Schema.shape);

export type AdditionalApplicantValues = z.infer<typeof additionalApplicantSchema>;
export type VisaExtensionStep1Values = z.infer<typeof visaExtensionStep1Schema>;
export type VisaExtensionRequestValues = z.infer<typeof visaExtensionRequestSchema>;

export const visaExtensionStepFields: Record<number, (keyof VisaExtensionRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "passportNumber", "dob", "insideUAE", "passportImageBase64"],
  1: ["entryDate"],
  2: ["additionalApplicants"],
  3: [],
};

export const visaExtensionStepLabels = ["Your Details", "Entry Date", "Other Applicants", "Summary"];
