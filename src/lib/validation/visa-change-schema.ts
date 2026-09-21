import { z } from "zod";

/**
 * Visa Change request validation — rewritten against the real locked spec
 * (client-message/Visa_Change.md), which contradicts the earlier
 * placeholder shape this schema used to have.
 *
 * The earlier version let the customer pick a specific departureAirportId/
 * arrivalAirportId/borderId directly from a <select> at request time. The
 * real spec is explicit and repeated (§4, §5, §7, §14, Locked Rules
 * #2/#3/#4/#6/#19): the customer chooses only the METHOD (Airport-to-
 * Airport vs Border Exit) — the actual airport/border is picked by STAFF
 * from the Admin master AFTER the lead exists and availability is
 * confirmed ("Customer sees only CRM-confirmed options," §19). Fixed here.
 *
 * §3: buyer enters fullName/passportNumber/visaLastDate/mobile/email, then
 * can "+ Add Another Passenger" (fullName/passportNumber/visaLastDate/
 * nationality/paxType each). Nationality isn't listed as a buyer-only
 * field in §3, but §11 needs a nationality to show the document checklist
 * before Lead creation — treating the buyer as the first passenger
 * (needs their own nationality/paxType too) is the practical reading;
 * flagged here as a judgment call, not silently assumed.
 *
 * No "processing type" concept exists anywhere in this spec (unlike OTB) —
 * removed, it was a copy-paste leftover from the OTB schema shape.
 */

/**
 * Applicant-wise passport copy (Visa Change handover doc: documents are
 * uploaded per applicant before the Lead is created). Optional in the schema
 * so the identity step isn't blocked by them — the documents step and the
 * API route both require them explicitly.
 */
const passportImageFields = {
  passportImageBase64: z.string().optional(),
  passportImageMimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]).optional(),
};

export const visaChangePassengerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the passenger's full name").max(80, "Name is too long"),
  passportNumber: z
    .string()
    .trim()
    .min(4, "Enter a passport number")
    .max(20, "Passport number is too long")
    .transform((value) => value.toUpperCase()),
  visaLastDate: z
    .string()
    .min(1, "Select the visa last date")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date"),
  nationality: z.string().trim().min(2, "Enter nationality").max(56, "Nationality is too long"),
  paxType: z.enum(["ADULT", "CHILD"], { error: "Select adult or child" }),
  ...passportImageFields,
});

export const visaChangeStep1Schema = z.object({
  changeType: z.enum(["AIRPORT_TO_AIRPORT", "BORDER_EXIT"], { error: "Select a visa change method" }),
});

export const visaChangeStep2Schema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
  passportNumber: z
    .string()
    .trim()
    .min(4, "Enter your passport number")
    .max(20, "Passport number is too long")
    .transform((value) => value.toUpperCase()),
  visaLastDate: z
    .string()
    .min(1, "Select your visa last date")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  nationality: z.string().trim().min(2, "Enter your nationality").max(56, "Nationality is too long"),
  // No `.default()` here — MultiStepRequestFlow's generic typing requires
  // the schema's Input type to equal its Output type (see the New Visa/OTB
  // schemas' own note on this); the actual default lives in this flow's
  // `defaultValues` prop instead.
  paxType: z.enum(["ADULT", "CHILD"]),
  ...passportImageFields,
  additionalPassengers: z.array(visaChangePassengerSchema),
});

export const visaChangeRequestSchema = visaChangeStep1Schema.extend(visaChangeStep2Schema.shape);

/** Applicants missing a passport copy, as `path` + message issues (primary first, then additional passengers in order). */
export function findMissingPassportImages(values: {
  passportImageBase64?: string;
  additionalPassengers: { passportImageBase64?: string }[];
}): { path: string; message: string }[] {
  const message = "Upload a copy of the passport";
  const issues: { path: string; message: string }[] = [];
  if (!values.passportImageBase64) issues.push({ path: "passportImageBase64", message });
  values.additionalPassengers.forEach((passenger, index) => {
    if (!passenger.passportImageBase64) issues.push({ path: `additionalPassengers.${index}.passportImageBase64`, message });
  });
  return issues;
}

export type VisaChangePassengerValues = z.infer<typeof visaChangePassengerSchema>;
export type VisaChangeRequestValues = z.infer<typeof visaChangeRequestSchema>;

export const visaChangeStepFields: Record<number, (keyof VisaChangeRequestValues)[]> = {
  0: ["changeType"],
  1: ["fullName", "passportNumber", "visaLastDate", "mobile", "email", "nationality", "additionalPassengers"],
  2: [],
  3: [],
};

export const visaChangeStepLabels = ["Method", "Your Details", "Documents", "Summary"];
