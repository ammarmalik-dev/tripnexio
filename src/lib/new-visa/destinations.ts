import { db } from "../db";

/**
 * Client doc 2026-10-20 (E5 / E8) — the New Visa destinations Admin made live. The website listing, the request
 * form and the WhatsApp bot all use this one list, each country once, in Admin's order. Disabled countries never
 * appear. Client 2026-10-23 audit — only a country with an active visa product (Admin → New Visa countries): a
 * published page alone was listed but could never be priced or paid.
 */
export async function getNewVisaDestinationIds(): Promise<string[]> {
  const configs = await db.newVisaCountryConfig.findMany({ where: { active: true, country: { active: true } }, distinct: ["countryId"], select: { countryId: true } });
  return configs.map((row) => row.countryId);
}

export async function getNewVisaDestinations(): Promise<{ id: string; code: string; name: string; flagOverride: string | null }[]> {
  const ids = await getNewVisaDestinationIds();
  if (ids.length === 0) return [];
  return db.country.findMany({
    where: { id: { in: ids }, active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, flagOverride: true },
  });
}
