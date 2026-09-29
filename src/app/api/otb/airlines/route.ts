import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getOtbGlobalRules, resolveAirlineRules } from "@/lib/otb/get-otb-rules";

/**
 * Public, unauthenticated — the OTB form's airline list with each airline's
 * Admin-configured prices and processing timelines (working days). Only
 * active airlines that require OTB are returned.
 */
export async function GET() {
  const [airlines, global] = await Promise.all([
    db.airline.findMany({
      where: { active: true, otbRequired: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: {
        otbPrices: {
          where: { active: true, country: { active: true } },
          select: { paxType: true, normalPrice: true, urgentPrice: true, country: { select: { code: true } } },
        },
      },
    }),
    getOtbGlobalRules(),
  ]);

  return jsonSuccess(
    airlines.map((airline) => {
      const rules = resolveAirlineRules(airline, global);
      return {
        code: airline.code,
        name: airline.name,
        logoUrl: airline.logoUrl,
        normalPrice: airline.normalPrice === null ? null : Number(airline.normalPrice),
        urgentPrice: airline.urgentPrice === null ? null : Number(airline.urgentPrice),
        // P18 — customer-visible prices per destination country + passenger type.
        prices: airline.otbPrices.map((price) => ({
          countryCode: price.country.code,
          paxType: price.paxType,
          normalPrice: Number(price.normalPrice),
          urgentPrice: price.urgentPrice === null ? null : Number(price.urgentPrice),
        })),
        ...rules,
      };
    })
  );
}
