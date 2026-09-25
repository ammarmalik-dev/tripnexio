import { z } from "zod";

const todayAtMidnight = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

/**
 * Return Verified Ticket request validation.
 *
 * Client update (2026-09-24): the customer no longer selects a visa
 * type/validity — they give an Expected Return Date instead, and
 * TripNexio aims to issue a ticket close to it, subject to live
 * ticket/vendor availability (never a server-computed exact date, and the
 * exact issued date is never selected by the customer). This replaces the
 * earlier locked rule ("Customer selects only the travel date... the
 * return/onward date is generated according to the selected visa type")
 * and the `visaType` field + `computeReturnDate()` it drove.
 *
 * Exported as a plain object schema so callers that need one field's own
 * validator in isolation (the WhatsApp bot's conversational field-by-field
 * collection, see src/lib/whatsapp-bot/flows.ts) can do
 * `returnTicketFieldsSchema.shape.travelDate`.
 */
export const returnTicketFieldsSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  travelDate: z
    .string()
    .min(1, "Select a travel date")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date >= todayAtMidnight();
    }, "Travel date must be today or later"),
  /** The customer's target return date — not a guarantee, see the module doc comment above. */
  expectedReturnDate: z
    .string()
    .min(1, "Select your expected return date")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid expected return date"),
  travelers: z
    .string()
    .trim()
    .regex(/^[1-9]$/, "Enter a number between 1 and 9 (contact us directly for 9+)"),
});

export const MAX_ADDITIONAL_RETURN_TICKET_APPLICANTS = 8;

const passportNumberField = z
  .string()
  .trim()
  .min(4, "Enter the passport number")
  .max(20, "Passport number is too long")
  .transform((value) => value.toUpperCase());

export const returnTicketAdditionalApplicantSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the full name").max(80, "Full name is too long"),
  passportNumber: passportNumberField,
});

/**
 * Website request (client update): destination country is admin-managed
 * (see ReturnTicketDestination), the primary applicant also gives a passport
 * number, and secondary applicants give only Full Name + Passport Number.
 * The passenger count is derived (1 + additional applicants), so `travelers`
 * from the WhatsApp-bot field schema above is omitted here.
 */
export const returnTicketRequestSchema = returnTicketFieldsSchema
  .omit({ travelers: true })
  .extend({
    passportNumber: passportNumberField,
    destinationCountryId: z.string().min(1, "Select a destination country"),
    additionalApplicants: z.array(returnTicketAdditionalApplicantSchema).max(MAX_ADDITIONAL_RETURN_TICKET_APPLICANTS),
  })
  .refine((values) => new Date(values.expectedReturnDate) >= new Date(values.travelDate), {
    message: "Expected return date must be on or after the travel date",
    path: ["expectedReturnDate"],
  });

export type ReturnTicketRequestValues = z.infer<typeof returnTicketRequestSchema>;

export const returnTicketStepFields: Record<number, (keyof ReturnTicketRequestValues)[]> = {
  0: ["fullName", "mobile", "email", "passportNumber", "destinationCountryId", "travelDate", "expectedReturnDate"],
  1: ["additionalApplicants"],
  2: [],
};

export const returnTicketStepLabels = ["Trip Details", "Other Applicants", "Summary"];
