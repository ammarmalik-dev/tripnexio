import { z } from "zod";

const weight = (label: string) => z.number({ error: `Enter the ${label} weight` }).int(`${label} weight must be a whole number`).min(0, "Can't be negative").max(100, "Can't exceed 100");

export const updateVendorScoringConfigSchema = z.object({
  serviceSuitabilityWeight: weight("service suitability"),
  processingTimeWeight: weight("processing time"),
  performanceWeight: weight("performance"),
  reliabilityWeight: weight("reliability"),
});

export type UpdateVendorScoringConfigValues = z.infer<typeof updateVendorScoringConfigSchema>;
