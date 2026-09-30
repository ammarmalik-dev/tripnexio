import { db } from "../../db";
import { createPricingRuleSchema, updatePricingRuleSchema } from "../../validation/pricing-rule-schema";
import { diffSnapshots, pricingRuleSnapshot, writePricingRuleHistory } from "../../pricing/rule-history";
import type { PricingRule } from "../../../generated/prisma/client";
import {
  AMBIGUOUS_MATCH,
  buildApply,
  createDuplicateTracker,
  indexByKey,
  loadCountryLookup,
  loadNationalityLookup,
  parseIsoDate,
  readCells,
  rowResult,
  zodRowErrors,
  type CellMapping,
  type EntityImporter,
  type ImportOp,
} from "./shared";
import type { ImportRowResult } from "../import-specs";

/** Same fallback as src/lib/pricing/validate-rule-refs.ts — a service with no Processing Types configured yet accepts the legacy codes. */
const LEGACY_PROCESSING_CODES = ["normal", "urgent"];

const MAPPING: CellMapping = {
  serviceType: ["service_type", "string"],
  processingType: ["processing_type", "string"],
  paxType: ["pax_type", "string"],
  vendorCost: ["vendor_cost", "number"],
  sellingPrice: ["selling_price", "number"],
  additionalCharges: ["additional_charges", "number"],
  validityFrom: ["validity_from", "string"],
  validityUntil: ["validity_until", "string"],
  active: ["active", "boolean"],
};
const EXTRA_COLUMNS = { countryId: "country_code", subServiceId: "sub_service_code", nationalityId: "nationality" };

interface RuleKeyParts {
  serviceType: string;
  countryId: string | null;
  processingType: string | null;
  paxType: string;
  subServiceId: string | null;
  nationality: string | null;
}

const ruleKey = (parts: RuleKeyParts) =>
  [parts.serviceType, parts.countryId ?? "", parts.processingType ?? "", parts.paxType, parts.subServiceId ?? "", (parts.nationality ?? "").toLowerCase()].join("|");

/**
 * Pricing Rules — matched by service + country + processing type + pax type
 * + sub-service + nationality. Only rules with no New Visa product and no
 * visa type are import targets (those two dimensions aren't in the CSV), so
 * a product-/visa-type-specific rule is never overwritten by an import; an
 * import row with the same key creates/updates the generic rule instead.
 * References are resolved by human code (country code, sub-service code,
 * nationality name, Processing Types code) with the same checks the manual
 * Pricing form's routes enforce. Every create/update writes a
 * PricingRuleHistory row.
 */
export const pricingRulesImporter: EntityImporter = {
  entityType: "PricingRule",
  async plan(records) {
    const [findCountry, findNationality, subServices, processingOptions, existing] = await Promise.all([
      loadCountryLookup(),
      loadNationalityLookup(),
      db.subService.findMany({ select: { id: true, serviceType: true, code: true } }),
      db.processingTypeOption.findMany({ select: { serviceType: true, code: true } }),
      db.pricingRule.findMany({ where: { newVisaConfigId: null, visaTypeId: null } }),
    ]);
    const subServiceByKey = new Map<string, string>(subServices.map((row) => [`${row.serviceType}|${row.code.toLowerCase()}`, row.id] as const));
    const processingByService = new Map<string, string[]>();
    for (const option of processingOptions) {
      const list = processingByService.get(option.serviceType) ?? [];
      list.push(option.code.toLowerCase());
      processingByService.set(option.serviceType, list);
    }
    const existingByKey = indexByKey<PricingRule>(existing, (rule) => ruleKey(rule));
    const checkDuplicate = createDuplicateTracker();

    const rows: ImportRowResult[] = [];
    const ops: { kind: "create" | "update"; run: ImportOp }[] = [];

    for (const record of records) {
      const { input, errors } = readCells(record.values, MAPPING);
      if (typeof input.serviceType === "string") input.serviceType = input.serviceType.toUpperCase();
      if (typeof input.paxType === "string") input.paxType = input.paxType.toUpperCase();
      const serviceType = typeof input.serviceType === "string" ? input.serviceType : "";

      const countryValue = record.values.country_code ?? "";
      const country = countryValue ? findCountry(countryValue) : undefined;
      if (countryValue && !country) errors.push(`country_code: unknown country "${countryValue}" — add it under Admin → Countries first.`);
      input.countryId = country?.id ?? null;

      const subServiceValue = record.values.sub_service_code ?? "";
      const subServiceId = subServiceValue ? subServiceByKey.get(`${serviceType}|${subServiceValue.toLowerCase()}`) : undefined;
      if (subServiceValue && !subServiceId) errors.push(`sub_service_code: no sub-service "${subServiceValue}" under ${serviceType || "this service"}.`);
      input.subServiceId = subServiceId ?? null;

      const nationalityValue = record.values.nationality ?? "";
      const nationality = nationalityValue ? findNationality(nationalityValue) : undefined;
      if (nationalityValue && !nationality) errors.push(`nationality: unknown nationality "${nationalityValue}" — add it under Admin → Nationalities first.`);
      input.nationalityId = nationality?.id ?? null;

      let validityFrom: Date | undefined;
      let validityUntil: Date | undefined;
      if (typeof input.validityFrom === "string") {
        const result = parseIsoDate(input.validityFrom, "validity_from");
        if (result.error) errors.push(result.error);
        else validityFrom = result.date;
      }
      if (typeof input.validityUntil === "string") {
        const result = parseIsoDate(input.validityUntil, "validity_until");
        if (result.error) errors.push(result.error);
        else validityUntil = result.date;
      }
      if (validityFrom && validityUntil && validityFrom > validityUntil) errors.push("validity_until: must be on or after validity_from.");

      const displayKey = [serviceType || "?", country?.code ?? "any country", record.values.processing_type || "any processing", (typeof input.paxType === "string" && input.paxType) || "?", subServiceValue || "all sub-services", nationality?.name ?? "all nationalities"].join(" / ");

      const parsed = createPricingRuleSchema.safeParse(input);
      if (!parsed.success) errors.push(...zodRowErrors(parsed.error, MAPPING, EXTRA_COLUMNS));
      if (parsed.success && parsed.data.processingType) {
        const configured = processingByService.get(parsed.data.serviceType);
        const allowed = configured && configured.length > 0 ? configured : LEGACY_PROCESSING_CODES;
        if (!allowed.includes(parsed.data.processingType)) {
          errors.push(`processing_type: "${parsed.data.processingType}" isn't configured for ${parsed.data.serviceType} (allowed: ${allowed.join(", ")}).`);
        }
      }
      if (errors.length > 0 || !parsed.success) {
        rows.push(rowResult(record.line, displayKey, "error", errors));
        continue;
      }

      const data = parsed.data;
      const keyParts: RuleKeyParts = {
        serviceType: data.serviceType,
        countryId: data.countryId ?? null,
        processingType: data.processingType ?? null,
        paxType: data.paxType,
        subServiceId: data.subServiceId ?? null,
        nationality: nationality?.name ?? null,
      };
      const key = ruleKey(keyParts);
      const duplicate = checkDuplicate(key, record.line);
      if (duplicate) {
        rows.push(rowResult(record.line, displayKey, "error", [duplicate]));
        continue;
      }

      const matches = existingByKey.get(key) ?? [];
      if (matches.length > 1) {
        rows.push(rowResult(record.line, displayKey, "error", [AMBIGUOUS_MATCH]));
        continue;
      }
      const match = matches[0];
      if (match) {
        const partial = updatePricingRuleSchema.safeParse(input);
        if (!partial.success) {
          rows.push(rowResult(record.line, displayKey, "error", zodRowErrors(partial.error, MAPPING, EXTRA_COLUMNS)));
          continue;
        }
        // Key columns never change on update — only the price/validity/active values do.
        const changes = {
          vendorCost: partial.data.vendorCost,
          sellingPrice: partial.data.sellingPrice,
          additionalCharges: partial.data.additionalCharges,
          validityFrom,
          validityUntil,
          active: partial.data.active,
          // Backfill the master link on a legacy free-text-nationality row.
          ...(nationality && !match.nationalityId ? { nationalityId: nationality.id, nationality: nationality.name } : {}),
        };
        rows.push(rowResult(record.line, displayKey, "update"));
        ops.push({
          kind: "update",
          run: async (tx, actor) => {
            const before = pricingRuleSnapshot(match);
            const updated = await tx.pricingRule.update({ where: { id: match.id }, data: changes });
            const { oldValues, newValues } = diffSnapshots(before, pricingRuleSnapshot(updated));
            await writePricingRuleHistory(tx, { pricingRuleId: match.id, action: "UPDATE", oldValues, newValues, userId: actor.userId });
          },
        });
      } else {
        rows.push(rowResult(record.line, displayKey, "create"));
        ops.push({
          kind: "create",
          run: async (tx, actor) => {
            const created = await tx.pricingRule.create({
              data: {
                serviceType: data.serviceType,
                countryId: data.countryId ?? null,
                processingType: data.processingType ?? null,
                paxType: data.paxType,
                subServiceId: data.subServiceId ?? null,
                nationalityId: nationality?.id ?? null,
                nationality: nationality?.name ?? null,
                vendorCost: data.vendorCost,
                sellingPrice: data.sellingPrice,
                additionalCharges: data.additionalCharges,
                validityFrom,
                validityUntil,
                active: data.active,
              },
            });
            await writePricingRuleHistory(tx, {
              pricingRuleId: created.id,
              action: "CREATE",
              oldValues: null,
              newValues: pricingRuleSnapshot(created),
              userId: actor.userId,
            });
          },
        });
      }
    }

    return { rows, apply: buildApply(ops) };
  },
};
