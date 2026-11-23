import { z } from "zod";
import { honeypotShape } from "./honeypot";

/** The six public website service forms that can leave an abandoned step-1 draft. */
export const DRAFT_SERVICE_TYPES = [
  "NEW_VISA",
  "VISA_EXTENSION",
  "VISA_CHANGE",
  "FLIGHT_SPECIAL_FARE",
  "RETURN_TICKET",
  "OTB",
] as const;

export type DraftServiceType = (typeof DRAFT_SERVICE_TYPES)[number];

/** The trip fields an abandoned draft may carry (any service form; missing ones are simply not sent). */
// Client doc 16 Nov (F1) — New Visa's first applicant (passport, date of birth, occupation, passport expiry) is kept too.
export const DRAFT_TRIP_FIELDS = ["destinationCountry", "airline", "travelDate", "departureTime", "processingType", "passportNumber", "dob", "occupation", "passportExpiry"] as const;
export type DraftTripField = (typeof DRAFT_TRIP_FIELDS)[number];

/**
 * POST /api/leads/draft — only the contact fields every service form
 * collects on its contact step (same rules as each service's own step-1
 * schema), plus which service the visitor started and the honeypot.
 */
export const leadDraftSchema = z.object({
  ...honeypotShape,
  serviceType: z.enum(DRAFT_SERVICE_TYPES),
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  // Client doc 16 Nov (C7) — whatever trip details the visitor had already filled in, so staff can follow up.
  trip: z
    .object(Object.fromEntries(DRAFT_TRIP_FIELDS.map((key) => [key, z.string().trim().max(120).optional()])) as Record<DraftTripField, z.ZodOptional<z.ZodString>>)
    .optional(),
});

export type LeadDraftValues = z.infer<typeof leadDraftSchema>;
