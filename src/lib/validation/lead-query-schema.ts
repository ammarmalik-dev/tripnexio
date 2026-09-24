import { z } from "zod";
import {
  ServiceType,
  type ServiceType as ServiceTypeType,
  LeadStatus,
  type LeadStatus as LeadStatusType,
  LeadTemperature,
  type LeadTemperature as LeadTemperatureType,
} from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const leadStatusValues = Object.values(LeadStatus) as [LeadStatusType, ...LeadStatusType[]];
const leadTemperatureValues = Object.values(LeadTemperature) as [LeadTemperatureType, ...LeadTemperatureType[]];

export const leadListQuerySchema = z.object({
  serviceType: z.enum(serviceTypeValues).optional(),
  status: z.enum(leadStatusValues).optional(),
  /** No "unset" filter option — a plain All/Cold/Warm/Hot dropdown, matching the roadmap prompt's "filterable on the Leads list" ask. */
  temperature: z.enum(leadTemperatureValues).optional(),
  search: z.string().trim().min(1).optional(),
  /** Step 53 — Command Centre's Sales Overview cards are period-scoped by createdAt; a card's link needs this to make the linked list's count actually match. */
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.enum(["createdAt_asc", "createdAt_desc"]).default("createdAt_desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type LeadListQueryValues = z.infer<typeof leadListQuerySchema>;
