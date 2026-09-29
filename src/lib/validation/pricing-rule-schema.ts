import { z } from "zod";
import { partialUpdateSchema } from "./partial-update";
import { ServiceType, type ServiceType as ServiceTypeType, PaxType, type PaxType as PaxTypeType } from "../../generated/prisma/enums";

const serviceTypeValues = Object.values(ServiceType) as [ServiceTypeType, ...ServiceTypeType[]];
const paxTypeValues = Object.values(PaxType) as [PaxTypeType, ...PaxTypeType[]];

/**
 * P23 — a Processing Types master code ("normal", "urgent", "express" …),
 * stored as the plain code string on PricingRule.processingType. Which codes
 * are valid for a service is checked server-side against that master
 * (src/lib/pricing/validate-rule-refs.ts); null = any / not applicable.
 */
const processingTypeField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{1,40}$/, "Select a valid processing type")
  .nullable()
  .optional();

export const createPricingRuleSchema = z.object({
  serviceType: z.enum(serviceTypeValues, { error: "Select a service" }),
  /** Omit for a rule not tied to a destination country (§4: "country where applicable"). */
  countryId: z.string().min(1).nullable().optional(),
  processingType: processingTypeField,
  paxType: z.enum(paxTypeValues, { error: "Select a passenger type" }),
  /** Omit/empty for a rule that applies to every nationality. */
  nationality: z.string().trim().min(2).optional(),
  /** Nationality master id (P06); null = every nationality. Takes precedence over `nationality`. */
  nationalityId: z.string().min(1).nullable().optional(),
  /** P10 — New Visa only: the product this price is for; null = every product of the country. */
  newVisaConfigId: z.string().min(1).nullable().optional(),
  /** P23 — optional sub-service (must belong to `serviceType`); null = every sub-service. */
  subServiceId: z.string().min(1).nullable().optional(),
  /** P23 — optional visa type; null = every visa type. */
  visaTypeId: z.string().min(1).nullable().optional(),
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
