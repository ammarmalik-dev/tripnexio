import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { REPORTS } from "@/lib/reports/registry";

/**
 * P25 (Locked Business Rules v2.0 §15) — the report catalogue. finance.manage
 * because several reports expose vendor cost / margin (Admin-only by default).
 */
export async function GET() {
  try {
    const auth = await requirePermission("finance.manage");
    if (auth.error) return auth.error;

    return jsonSuccess(
      REPORTS.map((report) => ({
        key: report.key,
        title: report.title,
        group: report.group,
        description: report.description,
        supportedFilters: report.supportedFilters,
      }))
    );
  } catch (error) {
    console.error("[api/admin/reports] list failed", error);
    return jsonError(500, "Couldn't load the report list. Please try again.");
  }
}
