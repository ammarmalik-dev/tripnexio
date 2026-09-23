import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType, PaxType, type PaxType as PaxTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const paxTypeValues = Object.values(PaxType) as [PaxTypeType, ...PaxTypeType[]];

/** "normal" | "urgent" — free string (not an enum) to match the same convention already used by New Visa's/OTB's own processingType values elsewhere. */
const processingTypeField = z.enum(["normal", "urgent"]).optional();

export const createPricingRuleSchema = z.object({
  serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
  /** Omit for a rule not tied to a destination country (§4: "country where applicable"). */
  countryId: z.string().min(1).optional(),
  processingType: processingTypeField,
  paxType: z.enum(paxTypeValues, { error: "Select a passenger type" }),
  /** Omit/empty for a rule that applies to every nationality. */
  nationality: z.string().trim().min(2).optional(),
  vendorCost: z.number().nonnegative("Vendor cost can't be negative").default(0),
  sellingPrice: z.number({ error: "Enter the selling price" }).nonnegative("Selling price can't be negative"),
  additionalCharges: z.number().nonnegative("Additional charges can't be negative").default(0),
  validityFrom: z.string().optional(),
  validityUntil: z.string().optional(),
  active: z.boolean().default(true),
});

export const updatePricingRuleSchema = partialUpdateSchema(createPricingRuleSchema);

export type CreatePricingRuleValues = z.infer<typeof createPricingRuleSchema>;
export type UpdatePricingRuleValues = z.infer<typeof updatePricingRuleSchema>;
