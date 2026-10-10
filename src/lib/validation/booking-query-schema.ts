import { z } from "zod";
import {
  BookingStatus,
  type BookingStatus as BookingStatusType,
  ServiceType,
  type ServiceType as ServiceTypeType,
  PaymentStatus,
  type PaymentStatus as PaymentStatusType,
} from "../../generated/prisma/enums";

const bookingStatusValues = Object.values(BookingStatus) as [BookingStatusType, ...BookingStatusType[]];
const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const paymentStatusValues = Object.values(PaymentStatus) as [PaymentStatusType, ...PaymentStatusType[]];
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
  /** P21 item 4 — filter by the booking's lead's serviceType. */
  serviceType: z.enum(serviceTypeValues).optional(),
  search: z.string().trim().min(1).optional(),
  /** Step 54 — standardized date-range filter, matching Leads/Quotations/Payments. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  /** Client corrections 2026-10-05 — POC (staff id or "unassigned"), country, travel date, payment, vendor and internal-status filters. */
  assignedStaffId: z.string().trim().min(1).optional(),
  countryId: z.string().trim().min(1).optional(),
  travelFrom: isoDay.optional(),
  travelTo: isoDay.optional(),
  paymentStatus: z.enum(paymentStatusValues).optional(),
  vendorId: z.string().trim().min(1).optional(),
  serviceStatusId: z.string().trim().min(1).optional(),
  /** Client testing 2026-10-09 (E13) — the customer-facing status label (across services). */
  customerStatus: z.string().trim().min(1).max(80).optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type BookingListQueryValues = z.infer<typeof bookingListQuerySchema>;
