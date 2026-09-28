import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createNationalitySchema = z.object({
  name: z.string().trim().min(2, "Enter a nationality").max(60, "Name is too long"),
  countryId: z.string().min(1, "Select a country"),
  active: z.boolean().default(true),
});

export const updateNationalitySchema = partialUpdateSchema(createNationalitySchema);
