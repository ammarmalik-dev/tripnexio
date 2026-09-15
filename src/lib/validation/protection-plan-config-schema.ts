import { z } from "zod";

export const updateProtectionPlanConfigSchema = z.object({
  defaultPrice: z.coerce.number().positive("Enter a price greater than 0.").optional(),
  termsText: z.string().trim().min(1, "Enter the terms and conditions text.").optional(),
  eligibilityConditions: z.array(z.string().trim().min(1)).min(1, "Add at least one eligibility condition.").optional(),
});

export type UpdateProtectionPlanConfigValues = z.infer<typeof updateProtectionPlanConfigSchema>;
