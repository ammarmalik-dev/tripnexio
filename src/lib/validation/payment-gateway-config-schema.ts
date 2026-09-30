import { z } from "zod";

/**
 * P24 — Admin → Payment Gateway. Only the non-secret setting is editable
 * here; every Razorpay key/secret stays in env and is never accepted by
 * this schema (an unknown key in the body is simply stripped).
 */
export const updatePaymentGatewayConfigSchema = z.object({
  /** null = use the built-in 24-hour default. */
  defaultPaymentLinkHours: z
    .number({ error: "Enter a number of hours" })
    .int("Enter whole hours")
    .min(1, "Must be at least 1 hour")
    .max(720, "Can't exceed 720 hours (30 days)")
    .nullable(),
});

export type UpdatePaymentGatewayConfigValues = z.infer<typeof updatePaymentGatewayConfigSchema>;
