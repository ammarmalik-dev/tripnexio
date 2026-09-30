import { z } from "zod";
import {
  BookingStatus,
  type BookingStatus as BookingStatusType,
  PaymentStatus,
  type PaymentStatus as PaymentStatusType,
  ServiceType,
  type ServiceType as ServiceTypeType,
  OcrExtractionStatus,
  type OcrExtractionStatus as OcrExtractionStatusType,
  DocumentExtractionType,
  type DocumentExtractionType as DocumentExtractionTypeType,
} from "../../generated/prisma/enums";

/**
 * P24 items 5/7/8 — query schemas for the read-only Admin monitoring
 * screens (Bookings, Audit Log, Configuration History, OCR Monitor).
 * Every param is optional; an unparseable date is rejected (400) rather
 * than silently ignored.
 */

const bookingStatusValues = Object.values(BookingStatus) as [BookingStatusType, ...BookingStatusType[]];
const paymentStatusValues = Object.values(PaymentStatus) as [PaymentStatusType, ...PaymentStatusType[]];
const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const ocrStatusValues = Object.values(OcrExtractionStatus) as [OcrExtractionStatusType, ...OcrExtractionStatusType[]];
const extractionTypeValues = Object.values(DocumentExtractionType) as [DocumentExtractionTypeType, ...DocumentExtractionTypeType[]];

const isoDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date");

const optionalText = z.string().trim().min(1).max(200).optional();

const dateRange = {
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
};

const pagination = {
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const adminBookingsQuerySchema = z.object({
  search: optionalText,
  serviceType: z.enum(serviceTypeValues).optional(),
  /** Country master id — matched against the lead's `details` destination fields. */
  countryId: optionalText,
  /** Lead assignee id, or "unassigned". */
  staffId: optionalText,
  /** Vendor on the lead's selected quotation. */
  vendorId: optionalText,
  status: z.enum(bookingStatusValues).optional(),
  serviceStatusId: optionalText,
  /** Latest payment's status, or "NONE" for bookings with no payment yet. */
  paymentStatus: z.union([z.enum(paymentStatusValues), z.literal("NONE")]).optional(),
  ...dateRange,
  ...pagination,
});
export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;

export const auditLogQuerySchema = z.object({
  /** Staff user id, or "system" for rows with no user (webhooks, automation). */
  userId: optionalText,
  entityType: optionalText,
  entityId: optionalText,
  action: optionalText,
  ...dateRange,
  ...pagination,
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const configHistoryQuerySchema = z.object({
  entityType: optionalText,
  userId: optionalText,
  ...dateRange,
  ...pagination,
});
export type ConfigHistoryQuery = z.infer<typeof configHistoryQuerySchema>;

export const ocrMonitorQuerySchema = z.object({
  status: z.enum(ocrStatusValues).optional(),
  extractionType: z.enum(extractionTypeValues).optional(),
  ...pagination,
});
export type OcrMonitorQuery = z.infer<typeof ocrMonitorQuerySchema>;

/** `{ gte, lte }` createdAt-style filter from an optional ISO range, or undefined when neither end is set. */
export function dateRangeFilter(dateFrom?: string, dateTo?: string): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;
  return { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) };
}
