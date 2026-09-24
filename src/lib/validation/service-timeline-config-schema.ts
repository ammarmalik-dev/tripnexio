import { z } from "zod";

const optionalHours = (label: string) =>
  z
    .number()
    .int(`Enter whole ${label}`)
    .min(0, "Can't be negative")
    .max(8760, "That's too long") // 1 year in hours
    .nullable()
    .optional();

export const updateServiceTimelineConfigSchema = z.object({
  documentVerificationHours: optionalHours("hours"),
  expectedCompletionHours: optionalHours("hours"),
  quotationResponseMinutes: z.number().int("Enter whole minutes").min(0, "Can't be negative").max(525600, "That's too long").nullable().optional(),
  paymentDeadlineHours: optionalHours("hours"),
  active: z.boolean().optional(),
});

export type UpdateServiceTimelineConfigValues = z.infer<typeof updateServiceTimelineConfigSchema>;
