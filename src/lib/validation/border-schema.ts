import { z } from "zod";
import { GccCountry, type GccCountry as GccCountryType } from "../../generated/prisma/enums";

const gccCountryValues = Object.values(GccCountry) as [GccCountryType, ...GccCountryType[]];

export const createBorderSchema = z.object({
  name: z.string().trim().min(2, "Enter a crossing name").max(120, "Name is too long"),
  side: z.enum(gccCountryValues, { error: "Select the non-UAE side of this crossing" }),
  uaeLocation: z.string().trim().min(2, "Enter the UAE-side location"),
  destinationLocation: z.string().trim().min(2, "Enter the destination-side location"),
  activeForVisaChange: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateBorderSchema = createBorderSchema.partial();

export type CreateBorderValues = z.infer<typeof createBorderSchema>;
export type UpdateBorderValues = z.infer<typeof updateBorderSchema>;
