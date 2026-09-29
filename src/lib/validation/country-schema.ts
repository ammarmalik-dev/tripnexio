import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createCountrySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Enter a short code, e.g. UAE")
    .max(20, "Code is too long")
    .transform((value) => value.toUpperCase().replace(/\s+/g, "_")),
  name: z.string().trim().min(2, "Enter a country name").max(80, "Name is too long"),
  /** P23 — an emoji or an image URL (https://… or /path); empty = auto flag from the code. */
  flagOverride: z
    .string()
    .trim()
    .max(500, "Flag override is too long")
    .nullable()
    .optional()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || /^https?:\/\//i.test(value) || value.startsWith("/") || value.length <= 16,
      "Use an emoji or an image URL starting with https://"
    ),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateCountrySchema = partialUpdateSchema(createCountrySchema);

export type CreateCountryValues = z.infer<typeof createCountrySchema>;
export type UpdateCountryValues = z.infer<typeof updateCountrySchema>;
