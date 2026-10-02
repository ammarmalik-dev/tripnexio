import { z } from "zod";

/** P20 — an optional legal/contact detail; blank clears it (stored as null, so the site hides it). */
const optionalDetail = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Too long")
    .transform((value) => (value === "" ? null : value))
    .optional();

/** A social profile link: blank clears it (back to the site default); otherwise a full https:// URL. */
const optionalSocialUrl = optionalDetail(300).refine((value) => !value || /^https:\/\/[^\s]+\.[^\s]+$/i.test(value), "Enter the full link starting with https://");

/** Always partial (PATCH-only, singleton pre-created by seed — no create schema, same pattern as tax-fee-config-schema.ts / invoice-config-schema.ts). */
export const updateSystemConfigSchema = z.object({
  companyName: z.string().trim().max(120, "Too long").optional(),
  companyTagline: z.string().trim().max(200, "Too long").optional(),
  companyAddress: z.string().trim().max(200, "Too long").optional(),
  companyPhone: z.string().trim().max(30, "Too long").optional(),
  companyEmail: z.string().trim().max(120, "Too long").optional(),
  /** Blank = use the site default (stored as null). */
  companyWhatsapp: optionalDetail(30).refine((value) => !value || value.replace(/\D/g, "").length >= 8, "Enter the number with country code, e.g. +91 92381 84005"),
  /** Blank = the default "automatically generated, please do not reply" disclaimer. */
  emailFooterText: optionalDetail(600),
  socialInstagram: optionalSocialUrl,
  socialFacebook: optionalSocialUrl,
  socialLinkedin: optionalSocialUrl,
  socialX: optionalSocialUrl,
  socialThreads: optionalSocialUrl,
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
  legalEntityName: optionalDetail(160),
  gstin: optionalDetail(20),
  jurisdiction: optionalDetail(160),
  grievanceOfficerName: optionalDetail(120),
  grievanceEmail: optionalDetail(120),
  grievancePhone: optionalDetail(30),
  grievanceAddress: optionalDetail(300),
  /** P09 working calendar — comma-separated JS weekday numbers (0 = Sunday ... 6 = Saturday). */
  weekendDaysIndia: z.string().trim().regex(/^\s*[0-6](\s*,\s*[0-6])*\s*$|^\s*$/, "Use weekday numbers 0-6, comma separated (0 = Sunday)").optional(),
  weekendDaysUae: z.string().trim().regex(/^\s*[0-6](\s*,\s*[0-6])*\s*$|^\s*$/, "Use weekday numbers 0-6, comma separated (0 = Sunday)").optional(),
  workdayStartHour: z.number().int().min(0, "0-23").max(23, "0-23").optional(),
  workdayEndHour: z.number().int().min(1, "1-24").max(24, "1-24").optional(),
});

export type UpdateSystemConfigValues = z.infer<typeof updateSystemConfigSchema>;
