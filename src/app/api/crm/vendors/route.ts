import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { serviceTypeCondition } from "@/lib/auth/service-scope";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getStaffVendorsView } from "@/lib/vendors/staff-view";
import type { ServiceType } from "@/generated/prisma/enums";

const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[];

/**
 * P22 item 6 — CRM.md §24 staff Vendors view (quotations.view). Read-only.
 * Service-scoped via serviceTypeCondition (an out-of-scope `service` filter
 * yields an empty list, not a 403 — same list-route convention). Average
 * vendor cost is computed server-side ONLY for vendors.viewCost holders
 * (admin.full passes); everyone else gets `averageCost: null`.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("quotations.view");
  if (auth.error) return auth.error;

  const service = request.nextUrl.searchParams.get("service");
  if (service && !SERVICE_TYPES.includes(service as ServiceType)) {
    return jsonError(400, "Invalid service query parameter.");
  }

  try {
    const { serviceType: serviceFilter } = serviceTypeCondition(auth.session, (service as ServiceType | null) ?? undefined);
    const view = await getStaffVendorsView({ serviceFilter, includeCost: hasPermission(auth.session, "vendors.viewCost") });
    return jsonSuccess(view);
  } catch (error) {
    console.error("[api/crm/vendors]", error);
    return jsonError(500, "Couldn't load vendors.");
  }
}
