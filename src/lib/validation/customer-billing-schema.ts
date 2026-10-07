import { z } from "zod";
import { GST_STATE_CODES, GSTIN_PATTERN } from "../gst/india-states";

/**
 * Client corrections 2026-10-05 (invoice sample) — the optional billing
 * details on an invoice. Shared by the customer's own profile and the CRM
 * Customer 360 edit. Empty strings clear a field.
 */
export const customerBillingSchema = z
  .object({
    billingAddress: z.string().trim().max(300, "Keep the address under 300 characters"),
    billingStateCode: z.union([z.enum(GST_STATE_CODES), z.literal("")]),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => value === "" || GSTIN_PATTERN.test(value), "Enter a valid 15-character GSTIN"),
  })
  .superRefine((data, ctx) => {
    if (data.gstin && data.billingStateCode && data.billingStateCode !== "96" && data.gstin.slice(0, 2) !== data.billingStateCode) {
      ctx.addIssue({ code: "custom", path: ["gstin"], message: "The GSTIN's first two digits must match the selected state." });
    }
  });

export type CustomerBillingValues = z.infer<typeof customerBillingSchema>;

/** Empty → null for storage. */
export function billingToDb(values: CustomerBillingValues) {
  return {
    billingAddress: values.billingAddress || null,
    billingStateCode: values.billingStateCode || null,
    gstin: values.gstin || null,
  };
}
