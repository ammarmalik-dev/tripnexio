import { db } from "../db";
import type { PaxType, ServiceType } from "../../generated/prisma/enums";

/**
 * Admin handover §3/§4 — "bulk/common apply": copy a service's pricing rules
 * for one country to other countries. Prices are the Admin's own source
 * rules, copied unchanged; nothing is invented. A target that already has a
 * rule for the same combination is skipped and reported — never overwritten.
 */

export interface PlannedRuleCopy {
  sourceRuleId: string;
  targetCountryId: string;
  targetCountryName: string;
  /** The New Visa product of the target country matched by stay / entry / category / validity (null when the source rule has none). */
  newVisaConfigId: string | null;
  summary: string;
}

export interface SkippedRuleCopy {
  sourceRuleId: string;
  targetCountryName: string;
  summary: string;
  reason: string;
}

export interface RuleCopyPlan {
  sourceCountryName: string;
  sourceRuleCount: number;
  creates: PlannedRuleCopy[];
  skipped: SkippedRuleCopy[];
}

const PAX_LABELS: Record<PaxType, string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };

/** Same identity a single create checks for duplicates (pricing-rules POST). */
function identityKey(rule: {
  processingType: string | null;
  paxType: PaxType;
  nationalityId: string | null;
  nationality: string | null;
  newVisaConfigId: string | null;
  subServiceId: string | null;
  visaTypeId: string | null;
}): string {
  return [rule.processingType, rule.paxType, rule.nationalityId, rule.nationality, rule.newVisaConfigId, rule.subServiceId, rule.visaTypeId]
    .map((value) => value ?? "")
    .join("|");
}

export async function planPricingRuleCopy(input: {
  serviceType: ServiceType;
  sourceCountryId: string;
  targetCountryIds: string[];
  ruleIds?: string[];
}): Promise<RuleCopyPlan | { error: string }> {
  const sourceCountry = await db.country.findUnique({ where: { id: input.sourceCountryId }, select: { name: true } });
  if (!sourceCountry) return { error: "Source country not found." };

  const sourceRules = await db.pricingRule.findMany({
    where: {
      serviceType: input.serviceType,
      countryId: input.sourceCountryId,
      ...(input.ruleIds && input.ruleIds.length > 0 ? { id: { in: input.ruleIds } } : {}),
    },
    include: {
      newVisaConfig: { select: { stayDays: true, entryKind: true, visaCategory: true, validityTypeId: true, duration: true } },
      visaType: { select: { countryId: true, name: true } },
    },
    orderBy: [{ paxType: "asc" }, { createdAt: "asc" }],
  });
  if (sourceRules.length === 0) return { error: "There are no pricing rules for this service and country to copy." };

  const targetIds = [...new Set(input.targetCountryIds)].filter((id) => id !== input.sourceCountryId);
  if (targetIds.length === 0) return { error: "Choose at least one other country." };
  const targetCountries = await db.country.findMany({ where: { id: { in: targetIds } }, select: { id: true, name: true } });
  if (targetCountries.length !== targetIds.length) return { error: "One of the chosen countries no longer exists." };

  const needsProducts = sourceRules.some((rule) => rule.newVisaConfigId);
  const targetProducts = needsProducts
    ? await db.newVisaCountryConfig.findMany({
        where: { countryId: { in: targetIds }, active: true },
        select: { id: true, countryId: true, stayDays: true, entryKind: true, visaCategory: true, validityTypeId: true },
        orderBy: { displayOrder: "asc" },
      })
    : [];
  const existingRules = await db.pricingRule.findMany({
    where: { serviceType: input.serviceType, countryId: { in: targetIds } },
    select: { countryId: true, processingType: true, paxType: true, nationalityId: true, nationality: true, newVisaConfigId: true, subServiceId: true, visaTypeId: true },
  });
  const existingKeys = new Set(existingRules.map((rule) => `${rule.countryId}#${identityKey(rule)}`));

  const creates: PlannedRuleCopy[] = [];
  const skipped: SkippedRuleCopy[] = [];

  for (const country of targetCountries) {
    for (const rule of sourceRules) {
      const parts = [
        PAX_LABELS[rule.paxType],
        rule.processingType,
        rule.newVisaConfig ? rule.newVisaConfig.duration || `${rule.newVisaConfig.stayDays ?? "?"} days` : null,
        rule.visaType?.name,
        rule.nationality ?? null,
      ].filter(Boolean);
      const summary = `${parts.join(" / ")} — ₹${rule.sellingPrice.toString()}`;
      const skip = (reason: string) => skipped.push({ sourceRuleId: rule.id, targetCountryName: country.name, summary, reason });

      if (rule.visaType?.countryId && rule.visaType.countryId !== country.id) {
        skip("Its visa type is only offered for the source country.");
        continue;
      }
      let newVisaConfigId: string | null = null;
      if (rule.newVisaConfigId && rule.newVisaConfig) {
        const source = rule.newVisaConfig;
        const matches = targetProducts.filter(
          (product) =>
            product.countryId === country.id &&
            product.stayDays === source.stayDays &&
            product.entryKind === source.entryKind &&
            product.visaCategory === source.visaCategory &&
            product.validityTypeId === source.validityTypeId
        );
        if (matches.length === 0) {
          skip("No matching New Visa product (same stay, entry, category and validity) in this country.");
          continue;
        }
        if (matches.length > 1) {
          skip("More than one matching New Visa product in this country — add this price by hand.");
          continue;
        }
        newVisaConfigId = matches[0].id;
      }
      const key = `${country.id}#${identityKey({ ...rule, newVisaConfigId })}`;
      if (existingKeys.has(key)) {
        skip("A rule for this combination already exists — left unchanged.");
        continue;
      }
      existingKeys.add(key); // two source rules can't land on the same target row
      creates.push({ sourceRuleId: rule.id, targetCountryId: country.id, targetCountryName: country.name, newVisaConfigId, summary });
    }
  }

  return { sourceCountryName: sourceCountry.name, sourceRuleCount: sourceRules.length, creates, skipped };
}
