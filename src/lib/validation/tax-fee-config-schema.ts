import { z } from "zod";

export const updateTaxFeeConfigSchema = z.object({
  gstRatePercent: z.number({ error: "Enter the GST/tax rate" }).min(0, "Can't be negative").max(100, "Can't exceed 100%"),
  gatewayFeePercent: z.number({ error: "Enter the gateway fee rate" }).min(0, "Can't be negative").max(100, "Can't exceed 100%"),
  /** Client doc 2026-10-15 (G5) — charge the gateway fee to the customer, or absorb it as our expense. */
  gatewayFeeChargedToCustomer: z.boolean().optional(),
});

export type UpdateTaxFeeConfigValues = z.infer<typeof updateTaxFeeConfigSchema>;
