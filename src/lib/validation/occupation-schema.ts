import { z } from "zod";

export const createOccupationSchema = z.object({
  name: z.string().trim().min(2, "Enter an occupation").max(60, "Name is too long"),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateOccupationSchema = createOccupationSchema.partial();
