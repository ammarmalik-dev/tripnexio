import { z } from "zod";
import { PaymentStatus, type PaymentStatus as PaymentStatusType } from "../../generated/prisma/enums";

const paymentStatusValues = Object.values(PaymentStatus) as [PaymentStatusType, ...PaymentStatusType[]];

export const paymentListQuerySchema = z.object({
  status: z.enum(paymentStatusValues).optional(),
  search: z.string().trim().min(1).optional(),
  /** Step 53 — Command Centre's Sales Overview cards are period-scoped by createdAt; a card's link needs this to make the linked list's count actually match. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaymentListQueryValues = z.infer<typeof paymentListQuerySchema>;
