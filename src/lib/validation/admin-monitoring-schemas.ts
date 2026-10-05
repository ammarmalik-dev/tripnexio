import { z } from "zod";
import {
  OcrExtractionStatus,
  type OcrExtractionStatus as OcrExtractionStatusType,
  DocumentExtractionType,
  type DocumentExtractionType as DocumentExtractionTypeType,
} from "../../generated/prisma/enums";

/**
 * P24 items 7/8 — query schemas for the read-only Admin monitoring
 * screens (Audit Log, Configuration History, OCR Monitor).
 * Every param is optional; an unparseable date is rejected (400) rather
 * than silently ignored.
 */

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
