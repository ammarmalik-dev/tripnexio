import { z } from "zod";
import { ProtectionPlanStatus, type ProtectionPlanStatus as ProtectionPlanStatusType } from "../../generated/prisma/enums";

const protectionPlanStatusValues = Object.values(ProtectionPlanStatus) as [ProtectionPlanStatusType, ...ProtectionPlanStatusType[]];

export const updateProtectionPlanStatusSchema = z.object({
  status: z.enum(protectionPlanStatusValues, { error: "Select a valid Protection Plan status" }),
  note: z.string().trim().min(1).max(1000).optional(),
});

/** Staff purchase on the customer's behalf — New_Visa.md §8: "without agreement the Protection Plan cannot be purchased." */
export const purchaseProtectionPlanSchema = z.object({
  termsAccepted: z.literal(true, { error: "The customer must accept the terms before purchasing." }),
});

/** P12 — manager/admin decision on a plan in refund review. */
export const protectionPlanRefundDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().min(3, "Add a note for this decision.").max(1000),
});

export type UpdateProtectionPlanStatusValues = z.infer<typeof updateProtectionPlanStatusSchema>;
export type PurchaseProtectionPlanValues = z.infer<typeof purchaseProtectionPlanSchema>;
