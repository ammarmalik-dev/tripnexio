import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];

/** Optional free-text profile fields (§12, Admin FINAL handover): kept as plain strings —
 * there's no structured "payment details"/"processing details" shape specified anywhere. */
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

/** Business Rules §8 "Vendor Selection" — 1-5 admin score, 5=best. */
const vendorScore = (label: string) => z.number({ error: `Rate ${label}` }).int().min(1, "Must be at least 1").max(5, "Must be at most 5");

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
  serviceSuitabilityScore: vendorScore("service suitability").default(3),
  processingTimeScore: vendorScore("processing time").default(3),
  performanceScore: vendorScore("performance").default(3),
  reliabilityScore: vendorScore("reliability").default(3),
});

export const updateAdminVendorSchema = partialUpdateSchema(createAdminVendorSchema);

export type CreateAdminVendorValues = z.infer<typeof createAdminVendorSchema>;
export type UpdateAdminVendorValues = z.infer<typeof updateAdminVendorSchema>;
