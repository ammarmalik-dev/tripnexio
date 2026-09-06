import { z } from "zod";
import { PaymentStatus, type PaymentStatus as PaymentStatusType } from "../../generated/prisma/enums";

const paymentStatusValues = Object.values(PaymentStatus) as [PaymentStatusType, ...PaymentStatusType[]];

export const paymentListQuerySchema = z.object({
  status: z.enum(paymentStatusValues).optional(),
  search: z.string().trim().min(1).optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaymentListQueryValues = z.infer<typeof paymentListQuerySchema>;
