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
  followUpIntervalDays: z.number().int("Enter whole days").min(1, "At least 1 day").max(90, "At most 90 days").nullable().optional(),
  /** P10 — New Visa minimum working days before travel (Normal / Express). */
  minTravelDaysNormal: z.number().int("Enter whole days").min(0, "Can't be negative").max(90, "At most 90 days").nullable().optional(),
  minTravelDaysExpress: z.number().int("Enter whole days").min(0, "Can't be negative").max(90, "At most 90 days").nullable().optional(),
  /** Client corrections 2026-10-05 — New Visa processing working days (Expected Approval Date). */
  processingDaysNormal: z.number().int("Enter whole days").min(0, "Can't be negative").max(90, "At most 90 days").nullable().optional(),
  processingDaysExpress: z.number().int("Enter whole days").min(0, "Can't be negative").max(90, "At most 90 days").nullable().optional(),
  /** P17 — Return Ticket auto-complete delay after the travel date. */
  autoCompleteAfterDays: z.number().int("Enter whole days").min(0, "Can't be negative").max(90, "At most 90 days").nullable().optional(),
  active: z.boolean().optional(),
});

export type UpdateServiceTimelineConfigValues = z.infer<typeof updateServiceTimelineConfigSchema>;
