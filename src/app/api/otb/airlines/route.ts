import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getOtbGlobalRules, resolveAirlineRules } from "@/lib/otb/get-otb-rules";

/**
 * Public, unauthenticated — the OTB form's airline list with each airline's
 * Admin-configured price per destination country (one rate for every
 * passenger, client reply 2026-10-13) and processing timelines (working days).
 * Only active airlines that require OTB are returned.
 */
export async function GET() {
  const [airlines, global] = await Promise.all([
    db.airline.findMany({
      // Client doc 2026-10-14 — only airlines Admin priced OTB for (country × airline); no separate airline flag.
      where: { active: true, otbPrices: { some: { active: true, country: { active: true } } } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        otbPrices: {
          where: { active: true, country: { active: true } },
          select: { paxType: true, normalPrice: true, urgentPrice: true, country: { select: { code: true } } },
          // ADULT first, so a country's ADULT row wins over an older Child / Infant row.
          orderBy: { paxType: "asc" },
        },
      },
    }),
    getOtbGlobalRules(),
  ]);

  return jsonSuccess(
    airlines.map((airline) => {
      // Urgent per destination is decided from `prices` (otbRulesForCountry in use-otb-airlines.ts).
      const rules = resolveAirlineRules(airline, global, true);
      const byCountry = new Map<string, { countryCode: string; normalPrice: number; urgentPrice: number | null }>();
      for (const price of airline.otbPrices) {
        if (byCountry.has(price.country.code)) continue;
        byCountry.set(price.country.code, {
          countryCode: price.country.code,
          normalPrice: Number(price.normalPrice),
          urgentPrice: price.urgentPrice === null ? null : Number(price.urgentPrice),
        });
      }
      return {
        code: airline.code,
        name: airline.name,
        logoUrl: airline.logoUrl,
        prices: [...byCountry.values()],
        ...rules,
      };
    })
  );
}
