import { z } from "zod";
import { ServiceType, type ServiceType as ServiceTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];

/** Admin management of the Vendor master — distinct from the lightweight GET /api/vendors dropdown lookup used by the quote builder. */
export const createAdminVendorSchema = z.object({
  name: z.string().trim().min(2, "Enter a vendor name").max(120, "Name is too long"),
  service: z.enum(serviceTypeValues, { error: "Select a service" }),
  active: z.boolean().default(true),
});

export const updateAdminVendorSchema = createAdminVendorSchema.partial();

export type CreateAdminVendorValues = z.infer<typeof createAdminVendorSchema>;
export type UpdateAdminVendorValues = z.infer<typeof updateAdminVendorSchema>;
