import { z } from "zod";
import { ServiceType, type ServiceType as ServiceTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];

/**
 * "selected/expired/pending" (Step 13's own wording) is derived, not a
 * stored column — Quotation only has isSelected/isExpired booleans. See
 * quotationStatus() in src/app/api/quotations/route.ts for the mapping.
 */
export const quotationListQuerySchema = z.object({
  serviceType: z.enum(serviceTypeValues).optional(),
  status: z.enum(["SELECTED", "EXPIRED", "PENDING"]).optional(),
  search: z.string().trim().min(1).optional(),
  /** Step 53 — Command Centre's Sales Overview cards are period-scoped by createdAt; a card's link needs this to make the linked list's count actually match. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  /** Client corrections 2026-10-05 — POC (staff id or "unassigned"), country and travel-date filters, through the lead. */
  assignedStaffId: z.string().trim().min(1).optional(),
  countryId: z.string().trim().min(1).optional(),
  travelFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  travelTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type QuotationListQueryValues = z.infer<typeof quotationListQuerySchema>;
