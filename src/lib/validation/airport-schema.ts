import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createAirportSchema = z.object({
  name: z.string().trim().min(2, "Enter an airport name").max(120, "Name is too long"),
  code: z
    .string()
    .trim()
    .min(3, "Enter a 3-letter IATA code")
    .max(4, "Airport codes are 3-4 letters")
    .transform((value) => value.toUpperCase()),
  country: z.string().trim().min(2, "Enter a country"),
  city: z.string().trim().min(2, "Enter a city"),
  countryId: z.string().min(1, "Select a country"),
  activeForA2AEntry: z.boolean().default(true),
  activeForA2AExit: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateAirportSchema = partialUpdateSchema(createAirportSchema);

export type CreateAirportValues = z.infer<typeof createAirportSchema>;
export type UpdateAirportValues = z.infer<typeof updateAirportSchema>;
