import { z } from "zod";
import { BookingStatus, type BookingStatus as BookingStatusType } from "../../generated/prisma/enums";

const bookingStatusValues = Object.values(BookingStatus) as [BookingStatusType, ...BookingStatusType[]];

/**
 * Step 53 — Command Centre's "Active Bookings" KPI is PENDING+CONFIRMED+
 * PROCESSING combined; a single-value `status` filter can't link to a
 * list matching that count. Accepts a comma-separated list (a single
 * value is just a 1-element list, so every existing caller/link keeps
 * working unchanged) and parses straight to `BookingStatus[]`.
 */
const statusListSchema = z
  .string()
  .transform((value) => value.split(",").map((part) => part.trim()))
  .pipe(z.array(z.enum(bookingStatusValues)).min(1));

export const bookingListQuerySchema = z.object({
  status: statusListSchema.optional(),
  search: z.string().trim().min(1).optional(),
  /** Step 54 — standardized date-range filter, matching Leads/Quotations/Payments. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type BookingListQueryValues = z.infer<typeof bookingListQuerySchema>;
