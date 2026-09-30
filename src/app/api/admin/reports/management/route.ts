import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { buildManagementReport } from "@/lib/reports/management";
import { parseReportQuery } from "@/lib/reports/query";

/**
 * P25 (Locked Business Rules v2.0 §15) — the management dashboard's figures
 * (Sales → … → Net Profit, GST liability, net cash movement) for a range,
 * with the previous equal-length range alongside for deltas. Same query
 * params as /api/admin/reports/[key] (all four optional filters apply,
 * except to Expenses — see src/lib/reports/management.ts). JSON only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission("finance.manage");
    if (auth.error) return auth.error;

    const parsed = parseReportQuery(new URL(request.url).searchParams);
    if (!parsed.ok) return jsonError(400, parsed.message, parsed.fieldErrors);

    return jsonSuccess(await buildManagementReport(parsed.value.filters));
  } catch (error) {
    console.error("[api/admin/reports/management] failed", error);
    return jsonError(500, "Couldn't build the management dashboard. Please try again.");
  }
}
