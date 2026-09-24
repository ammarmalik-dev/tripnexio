import { z } from "zod";

export const updateReturnTicketRuleConfigSchema = z.object({
  thirtyDayOffsetDays: z.number().int("Enter whole days").min(1, "At least 1 day").max(365, "That's too long"),
  sixtyDayOffsetDays: z.number().int("Enter whole days").min(1, "At least 1 day").max(365, "That's too long"),
  ninetyDayOffsetDays: z.number().int("Enter whole days").min(1, "At least 1 day").max(365, "That's too long"),
});

export type UpdateReturnTicketRuleConfigValues = z.infer<typeof updateReturnTicketRuleConfigSchema>;
