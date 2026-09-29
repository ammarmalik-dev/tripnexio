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
});

export type LeadDraftValues = z.infer<typeof leadDraftSchema>;
