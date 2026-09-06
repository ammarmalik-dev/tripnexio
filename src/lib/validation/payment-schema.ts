import { z } from "zod";

export const markPaymentSuccessSchema = z.object({
  /** Optional stub gateway reference — a real one is generated if omitted. */
  gatewayRef: z.string().trim().min(1).optional(),
});

export type MarkPaymentSuccessValues = z.infer<typeof markPaymentSuccessSchema>;
