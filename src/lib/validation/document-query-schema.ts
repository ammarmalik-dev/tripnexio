import { z } from "zod";
import { DocumentStatus, type DocumentStatus as DocumentStatusType } from "../../generated/prisma/enums";

const documentStatusValues = Object.values(DocumentStatus) as [DocumentStatusType, ...DocumentStatusType[]];

/**
 * Step 53 — Command Centre's "Documents Pending" KPI is REQUIRED+MISSING
 * combined; a single-value `status` filter can't link to a list matching
 * that count. Accepts a comma-separated list (a single value is just a
 * 1-element list, so every existing caller/link keeps working unchanged).
 */
const statusListSchema = z
  .string()
  .transform((value) => value.split(",").map((part) => part.trim()))
  .pipe(z.array(z.enum(documentStatusValues)).min(1));

/** Used by the /crm/documents review queue — listing every document, not just one booking/passenger's. */
export const documentListQuerySchema = z.object({
  status: statusListSchema.optional(),
  search: z.string().trim().min(1).optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type DocumentListQueryValues = z.infer<typeof documentListQuerySchema>;
