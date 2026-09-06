import { z } from "zod";

export const createAirlineSchema = z.object({
  name: z.string().trim().min(2, "Enter an airline name").max(120, "Name is too long"),
  code: z
    .string()
    .trim()
    .min(2, "Enter a 2-3 letter IATA code")
    .max(3, "Airline codes are 2-3 letters")
    .transform((value) => value.toUpperCase()),
  country: z.string().trim().min(2, "Enter a country"),
  otbRequired: z.boolean().default(false),
  normalPrice: z.number().nonnegative("Price can't be negative").optional(),
  urgentPrice: z.number().nonnegative("Price can't be negative").optional(),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateAirlineSchema = createAirlineSchema.partial();

export type CreateAirlineValues = z.infer<typeof createAirlineSchema>;
export type UpdateAirlineValues = z.infer<typeof updateAirlineSchema>;
