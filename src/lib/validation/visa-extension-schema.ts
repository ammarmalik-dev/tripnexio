import { z } from "zod";

/**
 * Visa Extension request validation. No frontend flow exists for this yet
 * (only OTB and New Visa do) — this schema exists so the API route can
 * already enforce the one hard business rule CLAUDE.md calls out for this
 * service: Entry Date is always mandatory. Field set otherwise mirrors the
 * sibling flows (fullName/mobile/email/destinationCountry/processingType);
 * revisit once a real multi-step UI is built for this service.
 */
export const visaExtensionRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Full name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid mobile number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  destinationCountry: z.string().min(1, "Select a destination country"),
  /// Mandatory per CLAUDE.md hard rule for this service — not `.optional()`.
  entryDate: z
    .string()
    .min(1, "Entry date is required")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid entry date"),
  processingType: z.enum(["normal", "urgent"], {
    error: "Select a processing type",
  }),
});

export type VisaExtensionRequestValues = z.infer<typeof visaExtensionRequestSchema>;
