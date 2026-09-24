import { z } from "zod";
import { RefundStatus, type RefundStatus as RefundStatusType } from "../../generated/prisma/enums";

const refundStatusValues = Object.values(RefundStatus) as [RefundStatusType, ...RefundStatusType[]];

export const refundListQuerySchema = z.object({
  status: z.enum(refundStatusValues).optional(),
  search: z.string().trim().min(1).optional(),
  /** Step 54 — standardized date-range filter, matching Leads/Quotations/Payments. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type RefundListQueryValues = z.infer<typeof refundListQuerySchema>;
