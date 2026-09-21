import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];

export const createDocumentRequirementSchema = z.object({
  nationality: z.string().trim().min(2, "Enter a nationality"),
  serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
  documentName: z.string().trim().min(2, "Enter a document name"),
  required: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const updateDocumentRequirementSchema = partialUpdateSchema(createDocumentRequirementSchema);

export type CreateDocumentRequirementValues = z.infer<typeof createDocumentRequirementSchema>;
export type UpdateDocumentRequirementValues = z.infer<typeof updateDocumentRequirementSchema>;
