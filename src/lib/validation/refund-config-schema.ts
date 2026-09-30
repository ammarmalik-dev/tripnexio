import { z } from "zod";
import { sensitiveReasonSchema } from "./sensitive-action";
import { RefundCutoff, ServiceType, type RefundCutoff as RefundCutoffT, type ServiceType as ServiceTypeT } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];
const cutoffValues = Object.values(RefundCutoff) as [RefundCutoffT, ...RefundCutoffT[]];

const deduction = (label: string) => z.number({ error: `Enter the ${label}` }).min(0, "Can't be negative").max(1_000_000, "Too large");

export const updateRefundConfigSchema = z.object({
  serviceType: z.enum(serviceTypeValues),
  fullRefundWindowHours: z.number().int().min(0).max(720).nullable(),
  preValidationDeduction: deduction("pre-validation deduction"),
  postValidationDeduction: deduction("post-validation deduction"),
  noRefundAfter: z.enum(cutoffValues),
  /** Sensitive admin action — the confirmation reason, written to the audit trail. */
  reason: sensitiveReasonSchema,
});

export type UpdateRefundConfigValues = z.infer<typeof updateRefundConfigSchema>;
