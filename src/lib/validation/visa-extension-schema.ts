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

export const visaExtensionRequestSchema = visaExtensionStep1Schema.extend(visaExtensionStep2Schema.shape);

export type VisaExtensionStep1Values = z.infer<typeof visaExtensionStep1Schema>;
export type VisaExtensionRequestValues = z.infer<typeof visaExtensionRequestSchema>;

export const visaExtensionStepFields: Record<number, (keyof VisaExtensionRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "passportNumber", "dob", "insideUAE"],
  1: ["entryDate"],
  2: [],
};

export const visaExtensionStepLabels = ["Your Details", "Entry Date", "Summary"];
