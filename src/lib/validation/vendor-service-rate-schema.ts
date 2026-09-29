import { z } from "zod";

const money = (label: string) => z.number({ error: `Enter a valid ${label}` }).nonnegative(`${label} can't be negative`).nullable();

/** "YYYY-MM-DD" (a date input's value) or null for "open". */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Enter a valid date")
  .nullable();

/**
 * P23 — ADMIN §12 "vendor cost/rate service-wise": one vendor's internal
 * cost/rate and validity window for one linked service. Every field is sent
 * on each save (null = not set). Internal only — never customer-facing.
 */
export const vendorServiceRateSchema = z
  .object({
    cost: money("cost"),
    rate: money("rate"),
    validFrom: dateOnly,
    validUntil: dateOnly,
  })
  .refine((value) => !value.validFrom || !value.validUntil || value.validUntil >= value.validFrom, {
    message: "Valid until must be on or after valid from",
    path: ["validUntil"],
  });

export type VendorServiceRateValues = z.infer<typeof vendorServiceRateSchema>;
