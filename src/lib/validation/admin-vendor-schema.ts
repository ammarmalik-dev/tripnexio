import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];

/** Optional free-text profile fields (§12, Admin FINAL handover): kept as plain strings —
 * there's no structured "payment details"/"processing details" shape specified anywhere. */
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

/** Admin management of the Vendor master — distinct from the lightweight GET /api/vendors dropdown lookup used by the quote builder. */
export const createAdminVendorSchema = z.object({
  name: z.string().trim().min(2, "Enter a vendor name").max(120, "Name is too long"),
  services: z.array(z.enum(serviceTypeValues)).min(1, "Select at least one service"),
  mobile: optionalText(30),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("").transform(() => undefined)),
  pocName: optionalText(120),
  processingDetails: optionalText(2000),
  availability: optionalText(500),
  gstNumber: optionalText(30),
  paymentDetails: optionalText(2000),
  active: z.boolean().default(true),
});

export const updateAdminVendorSchema = partialUpdateSchema(createAdminVendorSchema);

export type CreateAdminVendorValues = z.infer<typeof createAdminVendorSchema>;
export type UpdateAdminVendorValues = z.infer<typeof updateAdminVendorSchema>;
