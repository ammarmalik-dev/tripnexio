import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { getStaffSession } from "@/lib/auth/staff-session";
import { isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { getSalesOverview, getOperationsOverview, getActionQueue } from "@/lib/crm/dashboard";

const DEFAULT_PERIOD_DAYS = 30;

/**
 * Session-only, no specific `requirePermission` — same precedent as
 * GET /api/staff and GET /api/vendors ("low-sensitivity reference-data
 * reads used across many screens, not worth a dedicated permission"). This
 * is the CRM's landing page; gating it per sub-resource (leads.view AND
 * bookings.view AND ...) would leave a limited-permission staff member
 * looking at a broken landing page on login.
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");

  const endDate = endParam ? new Date(endParam) : new Date();
  const startDate = startParam ? new Date(startParam) : new Date(endDate.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return jsonError(400, "Invalid startDate/endDate.");
  }
  if (startDate > endDate) {
    return jsonError(400, "startDate must be before endDate.");
  }

  // Step 39 — a scoped staff member's landing page only aggregates their
  // allowed services (undefined = unrestricted, the query stays unchanged).
  const scope = isServiceScopeUnrestricted(session) ? undefined : session.allowedServiceTypes;

  // Sequential, not Promise.all — see the comment on getSalesOverview() in
  // src/lib/crm/dashboard.ts for why this dashboard route deliberately
  // avoids firing many DB queries at once against this environment's
  // connection-pool-limited local Postgres.
  const sales = await getSalesOverview({ startDate, endDate }, scope);
  const operations = await getOperationsOverview(scope);
  const actionQueue = await getActionQueue(scope);

  return jsonSuccess({
    period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    sales,
    operations,
    actionQueue,
  });
}
