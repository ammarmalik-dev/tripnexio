import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

/**
 * P12 — every destination country with its Protection Plan setting (enabled,
 * price override, terms override). A country with no row is shown as
 * disabled. `hasNewVisa` marks countries that actually sell New Visa.
 */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  try {
    const countries = await db.country.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        active: true,
        protectionPlanCountry: { select: { enabled: true, price: true, termsText: true, updatedAt: true } },
        _count: { select: { newVisaCountryConfigs: true } },
      },
    });
    return jsonSuccess(
      countries.map((country) => ({
        countryId: country.id,
        code: country.code,
        name: country.name,
        active: country.active,
        hasNewVisa: country._count.newVisaCountryConfigs > 0,
        enabled: country.protectionPlanCountry?.enabled ?? false,
        price: country.protectionPlanCountry?.price?.toString() ?? null,
        termsText: country.protectionPlanCountry?.termsText ?? null,
      }))
    );
  } catch (error) {
    console.error("[api/admin/protection-plan-countries]", error);
    return jsonError(500, "Couldn't load the country settings.");
  }
}
