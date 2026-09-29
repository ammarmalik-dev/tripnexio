import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { serviceTypeCondition } from "@/lib/auth/service-scope";
import { getCrmReports } from "@/lib/crm/reports";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts a full ISO timestamp (useDateRangeFilter) or a bare YYYY-MM-DD (expanded to that day's start/end, UTC). */
function parseBound(value: string | null, edge: "start" | "end"): Date | null {
  if (!value) return null;
  if (DATE_ONLY.test(value)) return new Date(`${value}${edge === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"}`);
  return new Date(value);
}

/**
 * P22 item 3 — CRM.md §29 staff Reports (leads.view). Service-scoped via
 * serviceTypeCondition. Vendor cost / margin are computed server-side ONLY
 * for finance.manage holders (admin.full passes) — everyone else gets
 * `finance: null` and the query never runs.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const to = parseBound(params.get("to"), "end") ?? new Date();
  const from = parseBound(params.get("from"), "start") ?? new Date(to.getTime() - 30 * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return jsonError(400, "Choose a valid date range.");
  }

  try {
    const reports = await getCrmReports({
      period: { from, to },
      serviceScope: serviceTypeCondition(auth.session),
      includeFinance: hasPermission(auth.session, "finance.manage"),
    });
    return jsonSuccess(reports);
  } catch (error) {
    console.error("[api/crm/reports]", error);
    return jsonError(500, "Couldn't load the reports.");
  }
}
