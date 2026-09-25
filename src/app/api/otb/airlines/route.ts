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
        ...rules,
      };
    })
  );
}
