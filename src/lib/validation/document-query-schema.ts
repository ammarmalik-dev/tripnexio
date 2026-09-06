import { z } from "zod";
import { DocumentStatus, type DocumentStatus as DocumentStatusType } from "../../generated/prisma/enums";

const documentStatusValues = Object.values(DocumentStatus) as [DocumentStatusType, ...DocumentStatusType[]];

/** Used by the /crm/documents review queue — listing every document, not just one booking/passenger's. */
export const documentListQuerySchema = z.object({
  status: z.enum(documentStatusValues).optional(),
  search: z.string().trim().min(1).optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type DocumentListQueryValues = z.infer<typeof documentListQuerySchema>;
