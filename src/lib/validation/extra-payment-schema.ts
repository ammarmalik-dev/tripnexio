import { z } from "zod";

export const createExtraPaymentSchema = z.object({
  amount: z.number({ error: "Enter an amount" }).positive("Amount must be greater than 0"),
  description: z.string().trim().min(1, "Enter a reason for this extra payment").max(200, "Keep it under 200 characters"),
});

export type CreateExtraPaymentValues = z.infer<typeof createExtraPaymentSchema>;
