import { z } from "zod";

/**
 * Visa Extension website request validation, per the client's updated
 * Developer Handover: every applicant gives Full Name, Passport Number and
 * Visa Expiry Date (the primary applicant also Mobile + Email), plus their
 * own passport copy, all before the Lead is created. Whether an applicant
 * previously received a visa through TripNexio is checked by staff against
 * the passport number (see visa-extension-eligibility.ts), not used to block
 * the submission.
 *
 * `dob` / `entryDate` below are only for the WhatsApp bot's own
 * conversational eligibility flow (client-message/Visa_Extension.md
 * §2/§25/§4) — they are not part of the website form any more.
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

const dateString = (message: string, invalid: string) =>
  z
    .string()
    .min(1, message)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), invalid);

const fullNameField = z.string().trim().min(2, "Enter the full name").max(80, "Full name is too long");
const passportNumberField = z
  .string()
  .trim()
  .min(4, "Enter the passport number")
  .max(20, "Passport number is too long")
  .transform((value) => value.toUpperCase());
const visaExpiryDateField = dateString("Enter the visa expiry date", "Enter a valid visa expiry date");

/** WhatsApp-bot-only field validators (see file header). */
export const visaExtensionBotFieldSchemas = {
  dob: dateString("Select your date of birth", "Enter a valid date of birth"),
  entryDate: z
    .string()
    .min(1, "Entry date is required")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date <= todayAtMidnight();
    }, "Entry date can't be in the future"),
};

export const visaExtensionStep1Schema = z.object({
  fullName: fullNameField,
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  passportNumber: passportNumberField,
  visaExpiryDate: visaExpiryDateField,
  ...passportImageFields,
});

/** Same details as the primary applicant minus mobile/email (already captured from the primary), plus their own passport copy. */
export const additionalApplicantSchema = z.object({
  fullName: fullNameField,
  passportNumber: passportNumberField,
  visaExpiryDate: visaExpiryDateField,
  ...passportImageFields,
});

export const visaExtensionStep2Schema = z.object({
  additionalApplicants: z.array(additionalApplicantSchema).max(MAX_ADDITIONAL_APPLICANTS),
});

export const visaExtensionRequestSchema = visaExtensionStep1Schema.extend(visaExtensionStep2Schema.shape);

export type AdditionalApplicantValues = z.infer<typeof additionalApplicantSchema>;
export type VisaExtensionStep1Values = z.infer<typeof visaExtensionStep1Schema>;
export type VisaExtensionRequestValues = z.infer<typeof visaExtensionRequestSchema>;

export const visaExtensionStepFields: Record<number, (keyof VisaExtensionRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "passportNumber", "visaExpiryDate", "passportImageBase64"],
  1: ["additionalApplicants"],
  2: [],
};

export const visaExtensionStepLabels = ["Your Details", "Other Applicants", "Summary"];
