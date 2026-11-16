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
  /**
   * Client doc 16 Nov (H6) — staff may enter the refund total themselves (e.g. the passenger's actual fare); omitted =
   * the computed amount. Never more than what is still refundable on the payment (checked server-side).
   */
  refundAmount: z.number({ error: "Enter the refund amount" }).positive("The refund amount must be more than 0").optional(),
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
  /** Client doc 16 Nov (H8, §8) — approving a bank-transfer refund: the bank transaction number and date (YYYY-MM-DD). */
  bankTransactionRef: z.string().trim().min(3, "Enter the transaction number").max(80).optional(),
  bankTransactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the transaction date").optional(),
  /** Business Rules §14 "Sensitive Admin Actions" — refund status changes are the approval action itself (see the route's own comment), so a reason is required, not optional, as the "Extra Confirmation" step. */
  reason: sensitiveReasonSchema,
});

/** Client doc 16 Nov (H5) — a rejected refund, corrected and sent back for approval. */
export const resubmitRefundSchema = z.object({
  refundAmount: z.number({ error: "Enter the refund amount" }).positive("The refund amount must be more than 0"),
  reason: sensitiveReasonSchema,
});

export type CreateRefundValues = z.infer<typeof createRefundSchema>;
export type UpdateRefundStatusValues = z.infer<typeof updateRefundStatusSchema>;
