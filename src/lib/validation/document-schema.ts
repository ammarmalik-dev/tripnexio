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

export const uploadDocumentSchema = z.object({
  fileUrl: z.string().trim().url("Enter a valid file URL"),
});

export type CreateDocumentValues = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentStatusValues = z.infer<typeof updateDocumentStatusSchema>;
export type UploadDocumentValues = z.infer<typeof uploadDocumentSchema>;
