import { z } from "zod";

export const createCountrySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Enter a short code, e.g. UAE")
    .max(20, "Code is too long")
    .transform((value) => value.toUpperCase().replace(/\s+/g, "_")),
  name: z.string().trim().min(2, "Enter a country name").max(80, "Name is too long"),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateCountrySchema = createCountrySchema.partial();

export type CreateCountryValues = z.infer<typeof createCountrySchema>;
export type UpdateCountryValues = z.infer<typeof updateCountrySchema>;
