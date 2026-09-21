import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType, PaxType, type PaxType as PaxTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const paxTypeValues = Object.values(PaxType) as [PaxTypeType, ...PaxTypeType[]];

export const createPricingRuleSchema = z.object({
  serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
  paxType: z.enum(paxTypeValues, { error: "Select a passenger type" }),
  /** Omit/empty for a rule that applies to every nationality. */
  nationality: z.string().trim().min(2).optional(),
  basePrice: z.number({ error: "Enter the base price" }).nonnegative("Base price can't be negative"),
  additionalCharges: z.number().nonnegative("Additional charges can't be negative").default(0),
  active: z.boolean().default(true),
});

export const updatePricingRuleSchema = partialUpdateSchema(createPricingRuleSchema);

export type CreatePricingRuleValues = z.infer<typeof createPricingRuleSchema>;
export type UpdatePricingRuleValues = z.infer<typeof updatePricingRuleSchema>;
