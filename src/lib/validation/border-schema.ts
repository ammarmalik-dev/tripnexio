import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createBorderSchema = z.object({
  name: z.string().trim().min(2, "Enter a crossing name").max(120, "Name is too long"),
  countryId: z.string().min(1, "Select the non-UAE side of this crossing"),
  uaeLocation: z.string().trim().min(2, "Enter the UAE-side location"),
  destinationLocation: z.string().trim().min(2, "Enter the destination-side location"),
  activeForVisaChange: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateBorderSchema = partialUpdateSchema(createBorderSchema);

export type CreateBorderValues = z.infer<typeof createBorderSchema>;
export type UpdateBorderValues = z.infer<typeof updateBorderSchema>;
