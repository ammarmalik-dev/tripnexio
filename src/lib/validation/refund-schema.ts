import { z } from "zod";
import { RefundStatus, type RefundStatus as RefundStatusType } from "../../generated/prisma/enums";

export const createRefundSchema = z.object({
  paidAmount: z.number({ error: "Enter the amount the customer paid" }).nonnegative("Paid amount can't be negative"),
  cancellationCharge: z.number({ error: "Enter the cancellation charge" }).nonnegative("Cancellation charge can't be negative"),
  gatewayCharge: z.number({ error: "Enter the gateway charge" }).nonnegative("Gateway charge can't be negative"),
  reason: z.string().trim().min(1).optional(),
  /** CRM.md §21 (Step 14) — empty/omitted means "applies to the whole booking", same as every refund before this step. */
  passengerIds: z.array(z.string()).optional(),
});

const refundStatusValues = Object.values(RefundStatus) as [RefundStatusType, ...RefundStatusType[]];

export const updateRefundStatusSchema = z.object({
  status: z.enum(refundStatusValues, { error: "Select a valid refund status" }),
  /** Business Rules §14 "Sensitive Admin Actions" — refund status changes are the approval action itself (see the route's own comment), so a reason is required, not optional, as the "Extra Confirmation" step. */
  note: z.string().trim().min(5, "Enter a reason (at least 5 characters)."),
});

export type CreateRefundValues = z.infer<typeof createRefundSchema>;
export type UpdateRefundStatusValues = z.infer<typeof updateRefundStatusSchema>;
