import { z } from "zod";
import { PaymentStatus, type PaymentStatus as PaymentStatusType } from "../../generated/prisma/enums";

const paymentStatusValues = Object.values(PaymentStatus) as [PaymentStatusType, ...PaymentStatusType[]];

/** Step 52 — the Extra Payment report's own filters: status + a created-date range, on top of the standard list's search/sort/paging. */
export const extraPaymentListQuerySchema = z.object({
  status: z.enum(paymentStatusValues).optional(),
  search: z.string().trim().min(1).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type ExtraPaymentListQueryValues = z.infer<typeof extraPaymentListQuerySchema>;
