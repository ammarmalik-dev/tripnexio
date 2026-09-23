import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createNewVisaPricingSchema = z.object({
  countryId: z.string().min(1, "Select a country"),
  processingType: z.enum(["normal", "urgent"], { error: "Select Normal or Express" }),
  adultPrice: z.number({ error: "Enter the adult price" }).nonnegative("Price can't be negative").max(1_000_000, "That's too large"),
  childPrice: z.number({ error: "Enter the child price" }).nonnegative("Price can't be negative").max(1_000_000, "That's too large"),
  infantPrice: z.number({ error: "Enter the infant price" }).nonnegative("Price can't be negative").max(1_000_000, "That's too large"),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateNewVisaPricingSchema = partialUpdateSchema(createNewVisaPricingSchema);

export type CreateNewVisaPricingValues = z.infer<typeof createNewVisaPricingSchema>;
export type UpdateNewVisaPricingValues = z.infer<typeof updateNewVisaPricingSchema>;
