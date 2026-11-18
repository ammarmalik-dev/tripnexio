import { z } from "zod";
import { partialUpdateSchema } from "../validation/partial-update";

/**
 * Client corrections 2026-10-05 — Visa Stay Type and Visa Validity Type
 * masters: small reusable lists with the same Create → List → Edit → Save
 * screen. `kind` is the URL segment under /api/admin/visa-masters/.
 */
export const VISA_MASTER_KINDS = ["stay-types", "validity-types", "entry-types"] as const;
export type VisaMasterKind = (typeof VISA_MASTER_KINDS)[number];

export function isVisaMasterKind(value: string): value is VisaMasterKind {
  return (VISA_MASTER_KINDS as readonly string[]).includes(value);
}

const base = {
  name: z.string().trim().min(2, "Enter a name").max(60, "Name is too long"),
  active: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
};

export const visaStayTypeSchema = z.object({ ...base, days: z.number({ error: "Enter the days" }).int().min(1, "At least 1 day").max(3650) });
export const visaValidityTypeSchema = z.object({ ...base, description: z.string().trim().max(300).nullable().optional() });
/** Client doc 16 Nov (K8) — Visa Entry Type: a short code (stored on New Visa products, fixed once created) + its name. */
export const visaEntryTypeSchema = z.object({
  ...base,
  code: z
    .string()
    .trim()
    .min(2, "Enter a short code")
    .max(30, "Code is too long")
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "_"))
    .refine((value) => /^[A-Z0-9_]{2,30}$/.test(value), "Use letters and numbers"),
  description: z.string().trim().max(300).nullable().optional(),
});
/** Editing never changes the code (products hold it). */
export const visaEntryTypeUpdateSchema = partialUpdateSchema(visaEntryTypeSchema.omit({ code: true }));

export const VISA_MASTER_CONFIG = {
  "stay-types": {
    label: "Visa Stay Type",
    entityType: "VisaStayType",
    create: visaStayTypeSchema,
    update: partialUpdateSchema(visaStayTypeSchema),
  },
  "validity-types": {
    label: "Visa Validity Type",
    entityType: "VisaValidityType",
    create: visaValidityTypeSchema,
    update: partialUpdateSchema(visaValidityTypeSchema),
  },
  "entry-types": {
    label: "Visa Entry Type",
    entityType: "VisaEntryType",
    create: visaEntryTypeSchema,
    update: visaEntryTypeUpdateSchema,
  },
} as const;
