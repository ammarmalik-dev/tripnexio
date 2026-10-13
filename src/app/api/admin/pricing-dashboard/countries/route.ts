import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { usesPricingRules } from "@/lib/pricing/price-sources";

/** Large enough for every realistic price list; the response says when it was cut. */
const MAX_RULES = 2000;

/**
 * Client corrections 2026-10-05 §31 — the Pricing Dashboard's country-wise
 * view: every pricing rule grouped by country (rules without a country form
 * an "All countries" group), each with its current price so Admin can open
 * one record and Edit → Save it. Admin-only (masters.manage); includes vendor
 * cost, which never leaves /api/admin.
 * Client reply 2026-10-13 — each country also carries the prices the website
 * really charges for Return Ticket (destination rate) and OTB (per airline),
 * and every pricing rule says whether its service reads pricing rules at all.
 */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  try {
    const rules = await db.pricingRule.findMany({
      include: {
        country: { select: { id: true, name: true, code: true, flagOverride: true, active: true } },
        subService: { select: { name: true } },
        visaType: { select: { name: true } },
        newVisaConfig: { select: { stayDays: true, entryKind: true } },
      },
      orderBy: [{ serviceType: "asc" }, { processingType: "asc" }, { paxType: "asc" }, { createdAt: "asc" }],
      take: MAX_RULES + 1,
    });
    const truncated = rules.length > MAX_RULES;
    const processingOptions = await db.processingTypeOption.findMany({ select: { serviceType: true, code: true, label: true } });
    const processingLabel = new Map(processingOptions.map((option) => [`${option.serviceType}:${option.code}`, option.label]));

    const countrySelect = { select: { id: true, name: true, code: true, flagOverride: true, active: true } } as const;
    const returnTickets = await db.returnTicketDestination.findMany({ include: { country: countrySelect } });
    const otbPrices = await db.otbPrice.findMany({
      include: { country: countrySelect, airline: { select: { name: true, code: true, active: true } } },
      orderBy: [{ airline: { name: "asc" } }, { paxType: "asc" }],
    });

    type CountryInfo = { id: string; name: string; code: string; flagOverride: string | null; active: boolean };
    const groups = new Map<string, { country: CountryInfo | null; rules: unknown[]; returnTicket: unknown; otbPrices: unknown[] }>();
    const groupFor = (country: CountryInfo | null) => {
      const key = country?.id ?? "__all__";
      if (!groups.has(key)) groups.set(key, { country, rules: [], returnTicket: null, otbPrices: [] });
      return groups.get(key)!;
    };
    for (const rule of rules.slice(0, MAX_RULES)) {
      groupFor(rule.country).rules.push({
        id: rule.id,
        serviceType: rule.serviceType,
        subService: rule.subService?.name ?? null,
        visaType: rule.visaType?.name ?? null,
        product: rule.newVisaConfig?.stayDays ? `${rule.newVisaConfig.stayDays} days${rule.newVisaConfig.entryKind ? ` · ${rule.newVisaConfig.entryKind === "MULTIPLE" ? "Multiple" : "Single"} entry` : ""}` : null,
        processingType: rule.processingType,
        processingLabel: rule.processingType ? (processingLabel.get(`${rule.serviceType}:${rule.processingType}`) ?? rule.processingType) : null,
        paxType: rule.paxType,
        nationality: rule.nationality,
        sellingPrice: Number(rule.sellingPrice),
        governmentFee: Number(rule.governmentFee),
        additionalCharges: Number(rule.additionalCharges),
        vendorCost: Number(rule.vendorCost),
        validityFrom: rule.validityFrom ? rule.validityFrom.toISOString().slice(0, 10) : null,
        validityUntil: rule.validityUntil ? rule.validityUntil.toISOString().slice(0, 10) : null,
        active: rule.active,
        used: usesPricingRules(rule.serviceType),
        updatedAt: rule.updatedAt,
      });
    }
    for (const row of returnTickets) {
      groupFor(row.country).returnTicket = {
        id: row.id,
        ratePerApplicant: Number(row.ratePerApplicant),
        airlineFeePerApplicant: Number(row.airlineFeePerApplicant),
        cancellationFee: row.cancellationFee === null ? null : Number(row.cancellationFee),
        active: row.active,
      };
    }
    for (const row of otbPrices) {
      groupFor(row.country).otbPrices.push({
        id: row.id,
        airlineName: row.airline.name,
        airlineCode: row.airline.code,
        airlineActive: row.airline.active,
        paxType: row.paxType,
        normalPrice: Number(row.normalPrice),
        urgentPrice: row.urgentPrice === null ? null : Number(row.urgentPrice),
        airlineFee: Number(row.airlineFee),
        active: row.active,
      });
    }

    const countries = [...groups.values()].sort((a, b) => {
      if (!a.country) return 1;
      if (!b.country) return -1;
      return a.country.name.localeCompare(b.country.name);
    });
    return jsonSuccess({ countries, truncated });
  } catch (error) {
    console.error("[pricing-dashboard/countries] failed", describeError(error));
    return jsonError(500, "Couldn't load the country pricing. Please try again.");
  }
}
