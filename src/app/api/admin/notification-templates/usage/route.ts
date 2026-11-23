import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { AUTOMATIONS } from "@/lib/automation/settings";

/**
 * Client doc 16 Nov (M4) — where each template event is used: the service statuses that send it (with the stage:
 * before / after payment) and the automations that send it (with their schedule), for the template filters and the
 * "Sent when" line on each template.
 */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const statuses = await db.serviceStatus.findMany({
    where: { notificationEvent: { not: null }, active: true },
    select: { serviceType: true, scope: true, name: true, notificationEvent: true, mapsToBookingStatus: true },
    orderBy: [{ serviceType: "asc" }, { scope: "asc" }, { displayOrder: "asc" }],
  });
  return jsonSuccess({
    statuses: statuses.map((status) => ({
      event: status.notificationEvent as string,
      serviceType: status.serviceType,
      scope: status.scope,
      name: status.name,
      stage: status.scope === "LEAD" || status.mapsToBookingStatus === "PENDING" ? "BEFORE_PAYMENT" : "AFTER_PAYMENT",
    })),
    automations: AUTOMATIONS.filter((automation) => automation.audience === "CUSTOMER").map((automation) => ({
      key: automation.key,
      label: automation.label,
      description: automation.description,
      events: automation.events,
    })),
  });
}
