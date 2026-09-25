import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

/**
 * Public, unauthenticated — feeds the New Visa landing page's product-card
 * selector (`NewVisaProductSelector.tsx`). Only active configs for active
 * countries, matching the client's own locked rule ("only active products
 * configured in Admin should be shown, do not hard-code public
 * availability"). `duration`/`processingType`/`visaCategory` here are
 * descriptive text (per `NewVisaCountryConfig`'s own schema comment, from
 * Step 43) — informational display only, not a pricing dimension. The
 * card's actual price comes from `GET /api/new-visa-price`, which reads
 * the real `PricingRule` table separately.
 */
export async function GET() {
  const configs = await db.newVisaCountryConfig.findMany({
    where: { active: true, country: { active: true } },
    orderBy: [{ country: { displayOrder: "asc" } }, { country: { name: "asc" } }],
    include: { country: { select: { code: true, name: true } } },
  });

  return jsonSuccess(
    configs.map((config) => ({
      countryCode: config.country.code,
      countryName: config.country.name,
      visaCategory: config.visaCategory,
      duration: config.duration,
      entryType: config.entryType,
      processingType: config.processingType,
    }))
  );
}
