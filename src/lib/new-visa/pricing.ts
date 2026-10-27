import { db } from "../db";
import type { PaxType } from "../../generated/prisma/enums";
import { groupInvoiceLines, PAX_LINE_LABELS, type InvoiceLine } from "../invoices/invoice-lines";
import { pickVendorRate } from "../vendors/service-rates";

export interface NewVisaPriceBreakdown {
  ratePerType: { adultPrice: number; childPrice: number; infantPrice: number };
  travellerCount: number;
  total: number;
  /** Step 40 — summed across all travellers, so New Visa's auto-checkout records a real margin. Client doc 2026-10-15: the expected vendor cost (see below). */
  vendorCost: number;
  /** Client corrections 2026-10-05 — invoice lines per passenger type, the vendor / government fee apart from the service fee. */
  invoiceLines: InvoiceLine[];
}

/**
 * Step 40 (Admin FINAL handover §4): reads the central `PricingRule` table.
 * One row per (NEW_VISA, country, processingType, paxType), optionally for a
 * product (NewVisaCountryConfig) and a passport nationality.
 *
 * Client doc 2026-10-15 — Admin sets only the customer's selling price, by
 * country × nationality × Adult / Child × Normal / Urgent. A rule for the
 * chosen product beats the country-wide one, and a rule for the customer's
 * nationality beats the "all nationalities" one. The vendor cost comes from
 * the Vendor rates (Pricing Dashboard): until staff pick the vendor on the
 * booking, the lowest active vendor rate for the passenger is the expected
 * cost (it fixes the GST on selling − vendor cost at payment time); picking
 * the vendor replaces it with that vendor's own rate (setBookingVendor).
 * Older rules that still carry their own vendor cost / government fee keep
 * using them when no vendor rate exists.
 *
 * Returns `null` — never a guessed/fallback price — if any traveller's
 * passenger type has no configured rule.
 */
export async function computeNewVisaPrice(input: {
  countryCode: string;
  /** P10 — the chosen product (NewVisaCountryConfig); its own rules win over the country-wide ones. */
  newVisaConfigId?: string | null;
  /** Client doc 2026-10-15 — the passport nationality (Nationality master id); its own rules win over "all nationalities". */
  nationalityId?: string | null;
  processingType: "normal" | "urgent";
  travellerPaxTypes: PaxType[];
}): Promise<NewVisaPriceBreakdown | null> {
  const country = await db.country.findUnique({ where: { code: input.countryCode } });
  if (!country) return null;

  const uniquePaxTypes = [...new Set(input.travellerPaxTypes)];
  const nationalityId = input.nationalityId || null;
  const allRules = await db.pricingRule.findMany({
    where: {
      serviceType: "NEW_VISA",
      countryId: country.id,
      processingType: input.processingType,
      paxType: { in: uniquePaxTypes },
      active: true,
      country: { active: true },
      AND: [
        // Live check 2026-10-21 — Admin saves the nationality's name next to its id, so `nationality: null` dropped
        // every nationality price. Country-wide = neither set (a legacy free-text-only row stays excluded).
        { OR: [{ nationalityId: null, nationality: null }, ...(nationalityId ? [{ nationalityId }] : [])] },
        { OR: [{ newVisaConfigId: null }, ...(input.newVisaConfigId ? [{ newVisaConfigId: input.newVisaConfigId }] : [])] },
      ],
    },
  });

  // Most specific first: product + nationality, product, nationality, country-wide.
  const score = (rule: (typeof allRules)[number]) => Number(rule.newVisaConfigId !== null) * 2 + Number(rule.nationalityId !== null);
  const ruleFor = (paxType: PaxType) =>
    allRules.filter((rule) => rule.paxType === paxType).sort((a, b) => score(b) - score(a))[0];
  if (uniquePaxTypes.some((paxType) => !ruleFor(paxType))) return null;

  const vendorRates = await db.vendorServiceRate.findMany({
    where: { serviceType: "NEW_VISA", countryId: country.id, active: true, vendor: { active: true } },
    select: { vendorId: true, airlineId: true, processingType: true, nationalityId: true, paxType: true, newVisaConfigId: true, cost: true },
  });
  // The lowest of each vendor's best-matching rate for this passenger type (and visa option — client doc 2026-10-27, E2).
  const expectedVendorCost = (paxType: PaxType): number | null => {
    const byVendor = new Map<string, typeof vendorRates>();
    for (const rate of vendorRates) byVendor.set(rate.vendorId, [...(byVendor.get(rate.vendorId) ?? []), rate]);
    const costs = [...byVendor.values()]
      .map((rows) => pickVendorRate(rows, { processingType: input.processingType, nationalityId, paxType, newVisaConfigId: input.newVisaConfigId ?? null }))
      .filter((rate): rate is (typeof vendorRates)[number] => rate !== null)
      .map((rate) => Number(rate.cost));
    return costs.length > 0 ? Math.min(...costs) : null;
  };

  const rateFor = (paxType: PaxType) => {
    const rule = ruleFor(paxType)!;
    return Number(rule.sellingPrice) + Number(rule.additionalCharges);
  };
  const vendorCostFor = (paxType: PaxType) => expectedVendorCost(paxType) ?? Number(ruleFor(paxType)!.vendorCost);
  const feeFor = (paxType: PaxType) => expectedVendorCost(paxType) ?? Number(ruleFor(paxType)!.governmentFee);

  const ratePerType = {
    adultPrice: uniquePaxTypes.includes("ADULT") ? rateFor("ADULT") : 0,
    childPrice: uniquePaxTypes.includes("CHILD") ? rateFor("CHILD") : 0,
    infantPrice: uniquePaxTypes.includes("INFANT") ? rateFor("INFANT") : 0,
  };

  let total = 0;
  let vendorCost = 0;
  for (const paxType of input.travellerPaxTypes) {
    total += rateFor(paxType);
    vendorCost += vendorCostFor(paxType);
  }

  const invoiceLines = groupInvoiceLines(
    input.travellerPaxTypes.map((paxType) => ({
      label: `${country.name} Visa — ${PAX_LINE_LABELS[paxType]}`,
      price: rateFor(paxType),
      governmentFee: feeFor(paxType),
    }))
  );

  return { ratePerType, travellerCount: input.travellerPaxTypes.length, total, vendorCost, invoiceLines };
}

/**
 * Client 2026-10-23 — "lead ban rahi hai, payment ka option nahi": the passenger types (Adult / Child) priced for
 * this selection. The website, the bot and the intake route use it so a request is never taken for a traveller
 * type that has no price (such a lead could never be paid — New Visa has no quotation).
 */
export async function pricedNewVisaPaxTypes(input: Omit<Parameters<typeof computeNewVisaPrice>[0], "travellerPaxTypes">): Promise<PaxType[]> {
  const priced: PaxType[] = [];
  for (const paxType of ["ADULT", "CHILD"] as const) {
    if (await computeNewVisaPrice({ ...input, travellerPaxTypes: [paxType] })) priced.push(paxType);
  }
  return priced;
}

/** True when Admin has set any New Visa price for the destination; without one it stays "Price on Request". */
export async function countryHasNewVisaPrices(countryCode: string): Promise<boolean> {
  const count = await db.pricingRule.count({ where: { serviceType: "NEW_VISA", active: true, country: { code: countryCode, active: true } } });
  return count > 0;
}
