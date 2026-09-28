import { z } from "zod";
import { ServiceType, type ServiceType as ServiceTypeT } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeT, ...ServiceTypeT[]];

/** A new Terms version — existing versions are never edited, only switched on/off, so accepted versions stay exactly as agreed. */
export const createServiceTermsSchema = z.object({
  serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
  countryId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(3, "Enter a title").max(120, "Title is too long"),
  body: z.string().trim().min(20, "Enter the full terms text").max(50000, "Terms text is too long"),
});

export const updateServiceTermsSchema = z.object({ active: z.boolean() });
