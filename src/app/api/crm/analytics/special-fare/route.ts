import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { getSpecialFareAnalytics } from "@/lib/special-fare/analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

/** P16 — Special Fare Phase 1 analytics (leads.view). Average margin only for finance.manage / admin. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;
  const scopeError = assertServiceAccess(auth.session, "FLIGHT_SPECIAL_FARE");
  if (scopeError) return scopeError;

  const params = request.nextUrl.searchParams;
  const to = params.get("to") ? new Date(`${params.get("to")}T23:59:59.999Z`) : new Date();
  const from = params.get("from") ? new Date(`${params.get("from")}T00:00:00.000Z`) : new Date(to.getTime() - 30 * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return jsonError(400, "Choose a valid date range.");

  try {
    return jsonSuccess(await getSpecialFareAnalytics({ from, to, includeMargin: hasPermission(auth.session, "finance.manage") }));
  } catch (error) {
    console.error("[api/crm/analytics/special-fare]", error);
    return jsonError(500, "Couldn't load the analytics.");
  }
}
