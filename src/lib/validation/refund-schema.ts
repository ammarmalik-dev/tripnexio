import { z } from "zod";
import { RefundStatus, type RefundStatus as RefundStatusType } from "../../generated/prisma/enums";
import { sensitiveReasonSchema } from "./sensitive-action";

/** The paid amount is never taken from the client — the server computes it from the Payment row. */
export const createRefundSchema = z.object({
  cancellationCharge: z.number({ error: "Enter the cancellation charge" }).nonnegative("Cancellation charge can't be negative"),
  gatewayCharge: z.number({ error: "Enter the gateway charge" }).nonnegative("Gateway charge can't be negative"),
  reason: z.string().trim().min(1).optional(),
  /** CRM.md §21 (Step 14) — empty/omitted means "applies to the whole booking", same as every refund before this step. */
  passengerIds: z.array(z.string()).optional(),
});

/**
 * Business Rules §14 "Sensitive Admin Actions" — the HTTP route's body
 * schema: refund creation requires the confirmation reason (collected by
 * ConfirmActionDialog, pre-filled from the calculator form's optional
 * reason). The calculator form itself keeps using `createRefundSchema`.
 */
export const createRefundRequestSchema = createRefundSchema.extend({ reason: sensitiveReasonSchema });

const refundStatusValues = Object.values(RefundStatus) as [RefundStatusType, ...RefundStatusType[]];

export const updateRefundStatusSchema = z.object({
  status: z.enum(refundStatusValues, { error: "Select a valid refund status" }),
  /** Business Rules §14 "Sensitive Admin Actions" — refund status changes are the approval action itself (see the route's own comment), so a reason is required, not optional, as the "Extra Confirmation" step. */
  reason: sensitiveReasonSchema,
});

export type CreateRefundValues = z.infer<typeof createRefundSchema>;
export type UpdateRefundStatusValues = z.infer<typeof updateRefundStatusSchema>;
