import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { auditLogQuerySchema, dateRangeFilter } from "@/lib/validation/admin-monitoring-schemas";
import type { Prisma } from "@/generated/prisma/client";

/**
 * P24 item 7 — Admin Audit Log viewer: paginated, filterable read of every
 * AuditTrail row. Gated by `staff.manage` (no new permission): the audit
 * trail is the record of what staff did, so it belongs with the permission
 * that already oversees staff accounts — Admin-only by default, since the
 * seeded Staff role doesn't hold it.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = auditLogQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const q = parsed.data;

  const timestamp = dateRangeFilter(q.dateFrom, q.dateTo);
  const where: Prisma.AuditTrailWhereInput = {
    ...(q.userId ? { byUserId: q.userId === "system" ? null : q.userId } : {}),
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(timestamp ? { timestamp } : {}),
  };

  try {
    const [total, rows] = await Promise.all([
      db.auditTrail.count({ where }),
      db.auditTrail.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          action: true,
          note: true,
          timestamp: true,
          byUser: { select: { id: true, name: true } },
        },
      }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      note: row.note,
      timestamp: row.timestamp,
      user: row.byUser,
    }));
    return jsonSuccess({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (error) {
    console.error("[api/admin/audit-log]", error);
    return jsonError(500, "Couldn't load the audit log. Please try again.");
  }
}
