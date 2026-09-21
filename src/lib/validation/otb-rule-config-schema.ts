import { z } from "zod";

export const updateOtbRuleConfigSchema = z.object({
  standardProcessingDays: z.number().int("Enter whole days").min(1, "At least 1 working day").max(365, "That's too long"),
  /** null clears it (no urgent minimum configured). */
  urgentProcessingDays: z.number().int("Enter whole days").min(0, "Can't be negative").max(365, "That's too long").nullable(),
});
