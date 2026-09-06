import { z } from "zod";
import { BookingStatus, type BookingStatus as BookingStatusType } from "../../generated/prisma/enums";

const bookingStatusValues = Object.values(BookingStatus) as [BookingStatusType, ...BookingStatusType[]];

export const bookingListQuerySchema = z.object({
  status: z.enum(bookingStatusValues).optional(),
  search: z.string().trim().min(1).optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type BookingListQueryValues = z.infer<typeof bookingListQuerySchema>;
