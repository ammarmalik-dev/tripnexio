import { z } from "zod";
import { RefundStatus, ServiceType, type RefundStatus as RefundStatusType, type ServiceType as ServiceTypeValue } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeValue, ...ServiceTypeValue[]];

const refundStatusValues = Object.values(RefundStatus) as [RefundStatusType, ...RefundStatusType[]];

export const refundListQuerySchema = z.object({
  status: z.enum(refundStatusValues).optional(),
  /** Client doc 16 Nov (H9) — Service, POC, Refund Type (Full / Partial) and Refund Method (Gateway / Bank Transfer). */
  serviceType: z.enum(serviceTypeValues).optional(),
  assignedStaffId: z.string().trim().min(1).optional(),
  refundType: z.enum(["FULL", "PARTIAL"]).optional(),
  method: z.enum(["GATEWAY", "BANK_TRANSFER"]).optional(),
  search: z.string().trim().min(1).optional(),
  /** Step 54 — standardized date-range filter, matching Leads/Quotations/Payments. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type RefundListQueryValues = z.infer<typeof refundListQuerySchema>;
