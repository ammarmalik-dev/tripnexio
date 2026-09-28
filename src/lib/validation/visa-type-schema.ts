import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createVisaTypeSchema = z.object({
  name: z.string().trim().min(2, "Enter a visa type").max(60, "Name is too long"),
  /** Omit/null = offered for every destination country. */
  countryId: z.string().min(1).nullable().optional(),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateVisaTypeSchema = partialUpdateSchema(createVisaTypeSchema);
