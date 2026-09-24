import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { ServiceType, type ServiceType as ServiceTypeT } from "@/generated/prisma/enums";

const ALL_SERVICE_TYPES = Object.values(ServiceType) as ServiceTypeT[];

/**
 * Step 42 (Admin FINAL handover §6) — self-healing list: every ServiceType
 * always gets a row (seed.ts pre-creates them, but this also covers a
 * ServiceType added after the seed last ran) so the Admin screen always
 * shows exactly one card per service, no separate "create" step.
 */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const existing = await db.serviceTimelineConfig.findMany();
  const existingTypes = new Set(existing.map((row) => row.serviceType));
  const missing = ALL_SERVICE_TYPES.filter((serviceType) => !existingTypes.has(serviceType));

  if (missing.length > 0) {
    await db.serviceTimelineConfig.createMany({ data: missing.map((serviceType) => ({ serviceType })) });
  }

  const rows = await db.serviceTimelineConfig.findMany({ orderBy: { serviceType: "asc" } });
  return jsonSuccess(rows);
}
