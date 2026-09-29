import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { computeNewVisaPrice } from "@/lib/new-visa/pricing";
import { productEntryLabel, productLabel, productStayLabel } from "@/lib/new-visa/products";

/**
 * Public, unauthenticated — the New Visa products (P10: one per country +
 * stay duration + entry type) for the landing-page selector and the
 * request form. Only active products of active countries (client's locked
 * rule: "only active products configured in Admin should be shown"). Each
 * carries its "from" price — one adult, Normal processing — computed by
 * the same `computeNewVisaPrice()` the real request uses; null when no
 * price is configured (never a guessed number).
 */
export async function GET() {
  const configs = await db.newVisaCountryConfig.findMany({
    where: { active: true, country: { active: true } },
    orderBy: [{ country: { displayOrder: "asc" } }, { country: { name: "asc" } }, { displayOrder: "asc" }, { stayDays: "asc" }],
    include: { country: { select: { code: true, name: true } } },
  });

  const products = await Promise.all(
    configs.map(async (config) => {
      const price = await computeNewVisaPrice({
        countryCode: config.country.code,
        newVisaConfigId: config.id,
        processingType: "normal",
        travellerPaxTypes: ["ADULT"],
      });
      return {
        id: config.id,
        countryCode: config.country.code,
        countryName: config.country.name,
        visaCategory: config.visaCategory,
        stayDays: config.stayDays,
        entryKind: config.entryKind,
        label: productLabel(config),
        duration: productStayLabel(config),
        entryType: productEntryLabel(config),
        processingType: config.processingType,
        fromPrice: price?.total ?? null,
      };
    })
  );

  return jsonSuccess(products);
}
