import { z } from "zod";
import { partialUpdateSchema } from "../validation/partial-update";

/**
 * Client corrections 2026-10-05 — Visa Stay Type and Visa Validity Type
 * masters: small reusable lists with the same Create → List → Edit → Save
 * screen. `kind` is the URL segment under /api/admin/visa-masters/.
 */
export const VISA_MASTER_KINDS = ["stay-types", "validity-types"] as const;
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
} as const;
