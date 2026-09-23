import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType, PaxType, type PaxType as PaxTypeT } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const paxTypeValues = Object.values(PaxType) as [PaxTypeT, ...PaxTypeT[]];

export const createDocumentRequirementSchema = z.object({
  serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
  /** Destination GCC country — omit for a rule not tied to one. */
  countryId: z.string().min(1).optional(),
  /** The applicant's own nationality — omit to apply to every nationality. */
  nationality: z.string().trim().min(2).optional(),
  /** Applicant category — omit to apply to every passenger type. */
  paxType: z.enum(paxTypeValues).optional(),
  documentName: z.string().trim().min(2, "Enter a document name"),
  required: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const updateDocumentRequirementSchema = partialUpdateSchema(createDocumentRequirementSchema);

export type CreateDocumentRequirementValues = z.infer<typeof createDocumentRequirementSchema>;
export type UpdateDocumentRequirementValues = z.infer<typeof updateDocumentRequirementSchema>;
