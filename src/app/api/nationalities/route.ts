import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

/**
 * Public, unauthenticated — the nationality picker (active options only, Admin-managed).
 * Client doc 16 Nov (F11) — `?service=NEW_VISA&country=AE`: only the nationalities that destination is priced for
 * (every nationality when a price covers all of them, or when nothing is priced yet).
 */
export async function GET(request: NextRequest) {
  const service = request.nextUrl.searchParams.get("service");
  const countryCode = request.nextUrl.searchParams.get("country")?.trim().slice(0, 20) || null;
  let onlyIds: string[] | null = null;
  if (service === "NEW_VISA" && countryCode) {
    const rules = await db.pricingRule.findMany({
      where: { serviceType: "NEW_VISA", active: true, country: { code: { equals: countryCode, mode: "insensitive" } } },
      select: { nationalityId: true, nationality: true },
    });
    const coversAll = rules.some((rule) => !rule.nationalityId && !rule.nationality);
    if (rules.length > 0 && !coversAll) onlyIds = [...new Set(rules.map((rule) => rule.nationalityId).filter((id): id is string => !!id))];
  }
  const nationalities = await db.nationality.findMany({
    where: { active: true, ...(onlyIds ? { id: { in: onlyIds } } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return jsonSuccess(nationalities);
}
