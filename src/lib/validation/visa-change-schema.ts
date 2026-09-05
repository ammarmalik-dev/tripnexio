import { z } from "zod";

/**
 * Visa Change request validation. No frontend flow exists for this yet —
 * this schema exists so the API route can already enforce the one hard
 * business rule CLAUDE.md calls out for this service: the customer never
 * types an airport or border name. `departureAirportId`/`arrivalAirportId`/
 * `borderId` are master-record ids (from a `<select>`, once the UI exists),
 * never free-text name fields. The API route additionally checks these ids
 * actually exist and are active in the Airport/Border tables — zod alone
 * can't do that DB lookup.
 */
const visaChangeContactSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  processingType: z.enum(["normal", "urgent"], {
    error: "Select a processing type",
  }),
});

export const visaChangeRequestSchema = z.discriminatedUnion("changeType", [
  visaChangeContactSchema.extend({
    changeType: z.literal("AIRPORT_TO_AIRPORT"),
    departureAirportId: z.string().min(1, "Select a departure airport"),
    arrivalAirportId: z.string().min(1, "Select an arrival airport"),
  }),
  visaChangeContactSchema.extend({
    changeType: z.literal("BORDER_EXIT"),
    borderId: z.string().min(1, "Select a border crossing"),
  }),
]);

export type VisaChangeRequestValues = z.infer<typeof visaChangeRequestSchema>;
