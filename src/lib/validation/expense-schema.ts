import { z } from "zod";

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1, "Select a category"),
  amount: z.number({ error: "Enter an amount" }).positive("Amount must be greater than 0"),
  date: z.string().min(1, "Select a date"),
  note: z.string().trim().max(300, "Note is too long").optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseValues = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseValues = z.infer<typeof updateExpenseSchema>;
