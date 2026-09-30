import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

/**
 * P24 item 7 — filter options for the Audit Log / Configuration History
 * screens: the distinct entity types and actions actually present in the
 * trail, plus every staff user (including deactivated ones — their past
 * actions stay searchable). `staff.manage` OR `masters.manage` (the two
 * screens' own permissions) may read it.
 */
export async function GET() {
  const staffAuth = await requirePermission("staff.manage");
  if (staffAuth.error) {
    const mastersAuth = await requirePermission("masters.manage");
    if (mastersAuth.error) return mastersAuth.error;
  }

  try {
    const [entityTypes, actions, users] = await Promise.all([
      db.auditTrail.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
      db.auditTrail.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
      db.user.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    ]);
    return jsonSuccess({
      entityTypes: entityTypes.map((row) => row.entityType),
      actions: actions.map((row) => row.action),
      users,
    });
  } catch (error) {
    console.error("[api/admin/audit-log/facets]", error);
    return jsonError(500, "Couldn't load filter options.");
  }
}
