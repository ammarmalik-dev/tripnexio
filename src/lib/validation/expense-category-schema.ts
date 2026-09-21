import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(60, "Name is too long"),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateExpenseCategorySchema = partialUpdateSchema(createExpenseCategorySchema);

export type CreateExpenseCategoryValues = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryValues = z.infer<typeof updateExpenseCategorySchema>;
