import { z } from "zod";
import { ServiceType } from "../../generated/prisma/enums";

// Restricts `code` to a real ServiceType value — this is a metadata layer
// over the 6 locked services, not a way to invent a meaningless 7th one
// with no actual request flow/schema/route behind it. See Step 6's scoping
// note in DEVELOPMENT_ROADMAP.md.
const serviceTypeValues = Object.values(ServiceType) as [string, ...string[]];

export const createServiceSchema = z.object({
  code: z.enum(serviceTypeValues, { error: "Select a service type" }),
  name: z.string().trim().min(2, "Enter a service name").max(80, "Name is too long"),
  shortDescription: z.string().trim().min(2, "Enter a short description").max(300, "Description is too long"),
  iconName: z.string().min(1, "Select an icon"),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceValues = z.infer<typeof createServiceSchema>;
export type UpdateServiceValues = z.infer<typeof updateServiceSchema>;
