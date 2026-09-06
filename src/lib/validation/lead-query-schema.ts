import { z } from "zod";
import {
  ServiceType,
  type ServiceType as ServiceTypeType,
  LeadStatus,
  type LeadStatus as LeadStatusType,
} from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const leadStatusValues = Object.values(LeadStatus) as [LeadStatusType, ...LeadStatusType[]];

export const leadListQuerySchema = z.object({
  serviceType: z.enum(serviceTypeValues).optional(),
  status: z.enum(leadStatusValues).optional(),
  search: z.string().trim().min(1).optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type LeadListQueryValues = z.infer<typeof leadListQuerySchema>;
