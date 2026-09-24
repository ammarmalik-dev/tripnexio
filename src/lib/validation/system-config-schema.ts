import { z } from "zod";

/** Always partial (PATCH-only, singleton pre-created by seed — no create schema, same pattern as tax-fee-config-schema.ts / invoice-config-schema.ts). */
export const updateSystemConfigSchema = z.object({
  companyName: z.string().trim().max(120, "Too long").optional(),
  companyTagline: z.string().trim().max(200, "Too long").optional(),
  companyAddress: z.string().trim().max(200, "Too long").optional(),
  companyPhone: z.string().trim().max(30, "Too long").optional(),
  companyEmail: z.string().trim().max(120, "Too long").optional(),
  currencyCode: z
    .string()
    .trim()
    .length(3, "Use a 3-letter ISO currency code, e.g. INR")
    .transform((v) => v.toUpperCase())
    .optional(),
  timezoneOffsetMinutes: z.number().int().min(-720, "Too small").max(840, "Too large").optional(),
  documentRetentionDays: z.number().int().min(1, "Must be at least 1 day").max(3650, "Too large").optional(),
  auditRetentionDays: z.number().int().min(1, "Must be at least 1 day").max(3650, "Too large").optional().nullable(),
  backupRetentionDays: z.number().int().min(1, "Must be at least 1 day").max(3650, "Too large").optional().nullable(),
  backupScheduleNote: z.string().trim().max(200, "Too long").optional(),
  maintenanceModeEnabled: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(300, "Too long").optional(),
  systemAlertEmail: z.string().trim().max(120, "Too long").optional(),
});

export type UpdateSystemConfigValues = z.infer<typeof updateSystemConfigSchema>;
