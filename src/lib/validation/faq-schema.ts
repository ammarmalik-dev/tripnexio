import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];

export const createFaqSchema = z.object({
  question: z.string().trim().min(4, "Enter a question"),
  answer: z.string().trim().min(4, "Enter an answer"),
  /** null/omitted = a general FAQ not tied to one service. */
  serviceType: z.enum(serviceTypeValues).nullable().optional(),
  category: z.string().trim().min(1).optional(),
  keywords: z.array(z.string().trim().min(1)).default([]),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  published: z.boolean().default(false),
});

export const updateFaqSchema = partialUpdateSchema(createFaqSchema);

export type CreateFaqValues = z.infer<typeof createFaqSchema>;
export type UpdateFaqValues = z.infer<typeof updateFaqSchema>;
