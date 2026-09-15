import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(60, "Name is too long"),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

export type CreateExpenseCategoryValues = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryValues = z.infer<typeof updateExpenseCategorySchema>;
