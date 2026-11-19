import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))), "Enter a valid date");

/**
 * Client doc 16 Nov (J11) — staff correct a manual lead's details in one Edit form (passengers are edited row by row
 * in Applicants; no separate Add Passenger). Every field is optional: only what the lead's service uses is applied.
 * Shared by the CRM form and PATCH /api/leads/[id]/details.
 */
export const leadDetailsEditSchema = z
  .object({
    travelDate: isoDate.optional(),
    /** Special Fare. */
    origin: z.string().trim().max(160).optional(),
    destination: z.string().trim().max(160).optional(),
    /** Special Fare round trip; "" clears it (one-way). */
    returnDate: isoDate.optional(),
    /** Visa Extension / Visa Change — the current visa's expiry. */
    visaExpiryDate: isoDate.optional(),
    /** Return Ticket — the customer's expected return date. */
    expectedReturnDate: isoDate.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.returnDate && data.travelDate && data.returnDate < data.travelDate) {
      ctx.addIssue({ code: "custom", message: "The return date must be on or after the travel date", path: ["returnDate"] });
    }
    if (data.origin && data.destination && data.origin.toLowerCase() === data.destination.toLowerCase()) {
      ctx.addIssue({ code: "custom", message: "Arrival must be different from departure", path: ["destination"] });
    }
  });

export type LeadDetailsEditValues = z.infer<typeof leadDetailsEditSchema>;
