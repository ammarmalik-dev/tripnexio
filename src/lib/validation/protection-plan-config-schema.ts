import { z } from "zod";

export const updateProtectionPlanConfigSchema = z.object({
  defaultPrice: z.coerce.number().positive("Enter a price greater than 0.").optional(),
  termsText: z.string().trim().min(1, "Enter the terms and conditions text.").optional(),
  eligibilityConditions: z.array(z.string().trim().min(1)).min(1, "Add at least one eligibility condition.").optional(),
});

export type UpdateProtectionPlanConfigValues = z.infer<typeof updateProtectionPlanConfigSchema>;

/** P12 — one destination country's setting; `null` price/terms = use the global default. */
export const updateProtectionPlanCountrySchema = z.object({
  enabled: z.boolean().optional(),
  price: z.number().positive("Enter a price greater than 0.").max(10_000_000).nullable().optional(),
  termsText: z
    .string()
    .trim()
    .max(20000)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
});

export type UpdateProtectionPlanCountryValues = z.infer<typeof updateProtectionPlanCountrySchema>;
