import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType, PaxType, type PaxType as PaxTypeT } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const paxTypeValues = Object.values(PaxType) as [PaxTypeT, ...PaxTypeT[]];

const requirementFields = z.object({
  serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
  /** Destination GCC country — omit for a rule not tied to one. */
  countryId: z.string().min(1).optional(),
  /** The applicant's own nationality — omit to apply to every nationality. */
  nationality: z.string().trim().min(2).optional(),
  /** Nationality master id (P06); null = every nationality. Takes precedence over `nationality`. */
  nationalityId: z.string().min(1).nullable().optional(),
  /** Applicant category — omit to apply to every passenger type. */
  paxType: z.enum(paxTypeValues).optional(),
  /** Client corrections 2026-10-05 — the Document Master entry (the Admin screen always sends this). */
  documentTypeId: z.string().min(1).optional(),
  /** Older callers / CSV import: matched to (or added to) the Document Master by name. */
  documentName: z.string().trim().min(2, "Enter a document name").optional(),
  required: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const createDocumentRequirementSchema = requirementFields.refine((value) => Boolean(value.documentTypeId || value.documentName), {
  message: "Select a document from the Document Master",
  path: ["documentTypeId"],
});

export const updateDocumentRequirementSchema = partialUpdateSchema(requirementFields);

export type CreateDocumentRequirementValues = z.infer<typeof createDocumentRequirementSchema>;
export type UpdateDocumentRequirementValues = z.infer<typeof updateDocumentRequirementSchema>;
