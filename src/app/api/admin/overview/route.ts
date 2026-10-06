import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { getStaffSession } from "@/lib/auth/staff-session";
import { canAccessAdminSection, hasPermission } from "@/lib/auth/permissions";
import { buildAdminOverview } from "@/lib/admin/overview";

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_DAYS = new Set([7, 30, 90]);

/**
 * Client corrections 2026-10-05 — data for the Admin Overview. Any Admin
 * user may open it; revenue / profit / margin figures only for finance.manage.
 * `?days=7|30|90` (default 30): the last N days up to the end of today (UTC).
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");
  if (!canAccessAdminSection(session)) return jsonError(403, "You don't have access to the Admin Panel.");

  const daysParam = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY_MS);
  const from = new Date(to.getTime() - days * DAY_MS);

  try {
    const overview = await buildAdminOverview({ from, to, includeFinance: hasPermission(session, "finance.manage") });
    return jsonSuccess({ ...overview, days });
  } catch (error) {
    console.error("[api/admin/overview] failed", error);
    return jsonError(500, "Couldn't load the overview. Please try again.");
  }
}
