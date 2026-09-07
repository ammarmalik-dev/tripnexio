import { z } from "zod";

export const updateTaxFeeConfigSchema = z.object({
  gstRatePercent: z.number({ error: "Enter the GST/tax rate" }).min(0, "Can't be negative").max(100, "Can't exceed 100%"),
  gatewayFeePercent: z.number({ error: "Enter the gateway fee rate" }).min(0, "Can't be negative").max(100, "Can't exceed 100%"),
});

export type UpdateTaxFeeConfigValues = z.infer<typeof updateTaxFeeConfigSchema>;
