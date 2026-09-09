import { z } from "zod";
import { DocumentStatus, type DocumentStatus as DocumentStatusType } from "../../generated/prisma/enums";

const documentStatusValues = Object.values(DocumentStatus) as [DocumentStatusType, ...DocumentStatusType[]];

export const createDocumentSchema = z
  .object({
    passengerId: z.string().min(1).optional(),
    bookingId: z.string().min(1).optional(),
    type: z.string().trim().min(1, "Enter a document type"),
    status: z.enum(documentStatusValues).optional(),
  })
  .refine((value) => Boolean(value.passengerId || value.bookingId), {
    message: "Provide a passengerId or a bookingId",
    path: ["passengerId"],
  });

export const updateDocumentStatusSchema = z.object({
  status: z.enum(documentStatusValues, { error: "Select a valid document status" }),
});

/**
 * Two input modes (Step 16, audit §3.6): the original "paste an
 * already-hosted URL" (unchanged), or upload real file bytes directly —
 * added so Ticket/Visa documents can be genuinely uploaded through the same
 * generic route the passport-specific /api/passengers/[id]/passport-photo
 * route was built for, rather than requiring a separately-hosted URL for
 * every non-passport document.
 */
export const uploadDocumentSchema = z.union([
  z.object({ fileUrl: z.string().trim().url("Enter a valid file URL") }),
  z.object({
    fileBase64: z.string().min(1, "Choose a file to upload"),
    mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"], { error: "Unsupported file type" }),
  }),
]);

export type CreateDocumentValues = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentStatusValues = z.infer<typeof updateDocumentStatusSchema>;
export type UploadDocumentValues = z.infer<typeof uploadDocumentSchema>;
