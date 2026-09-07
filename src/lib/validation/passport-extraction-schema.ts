import { z } from "zod";

/** Whatever the staff member ends up confirming — pre-filled from OCR, but always editable before saving (never trust OCR output blind). */
const extractedFieldsSchema = z.object({
  fullName: z.string().trim().max(80).optional(),
  passportNumber: z.string().trim().max(20).optional(),
  nationality: z.string().trim().max(60).optional(),
  dob: z.string().trim().optional(),
  sex: z.string().trim().max(1).optional(),
  expiryDate: z.string().trim().optional(),
  issuingCountry: z.string().trim().max(60).optional(),
});

export const reviewPassportExtractionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), fields: extractedFieldsSchema }),
  z.object({ action: z.literal("reject") }),
]);

export type ReviewPassportExtractionValues = z.infer<typeof reviewPassportExtractionSchema>;
