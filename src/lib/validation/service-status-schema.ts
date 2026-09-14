import { z } from "zod";
import { ServiceType, StatusScope, LeadStatus, BookingStatus, type ServiceType as ServiceTypeT, type StatusScope as StatusScopeT, type LeadStatus as LeadStatusT, type BookingStatus as BookingStatusT } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];
const statusScopeValues = Object.values(StatusScope) as [StatusScopeT, ...StatusScopeT[]];
const leadStatusValues = Object.values(LeadStatus) as [LeadStatusT, ...LeadStatusT[]];
const bookingStatusValues = Object.values(BookingStatus) as [BookingStatusT, ...BookingStatusT[]];

export const createServiceStatusSchema = z.object({
  serviceType: z.enum(serviceTypeValues),
  scope: z.enum(statusScopeValues),
  name: z.string().trim().min(1, "Enter a status name.").max(100),
  group: z.string().trim().max(60).optional(),
  displayOrder: z.coerce.number().int().default(0),
  isTerminal: z.boolean().default(false),
  blocksRefund: z.boolean().default(false),
  customerLabel: z.string().trim().max(200).optional(),
  mapsToLeadStatus: z.enum(leadStatusValues).nullable().optional(),
  mapsToBookingStatus: z.enum(bookingStatusValues).nullable().optional(),
});

export const updateServiceStatusSchema = createServiceStatusSchema
  .omit({ serviceType: true, scope: true })
  .partial()
  .extend({ active: z.boolean().optional() });

export const createServiceStatusTransitionSchema = z.object({
  fromStatusId: z.string().trim().min(1),
  toStatusId: z.string().trim().min(1),
});

export type CreateServiceStatusValues = z.infer<typeof createServiceStatusSchema>;
export type UpdateServiceStatusValues = z.infer<typeof updateServiceStatusSchema>;
export type CreateServiceStatusTransitionValues = z.infer<typeof createServiceStatusTransitionSchema>;
