import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";

/** Client corrections 2026-10-05 — a Document Master entry. */
export const createDocumentTypeSchema = z.object({
  name: z.string().trim().min(2, "Enter the document name").max(120, "Name is too long"),
  description: z.string().trim().max(300, "Description is too long").nullable().optional(),
  defaultMandatory: z.boolean().default(true),
  active: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export const updateDocumentTypeSchema = partialUpdateSchema(createDocumentTypeSchema);

export type CreateDocumentTypeValues = z.infer<typeof createDocumentTypeSchema>;
