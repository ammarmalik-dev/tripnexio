import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { getTimezoneOffsetMinutes } from "@/lib/settings/system-config";
import { getStaffIdsOnApprovedLeave, isRosterEligible } from "@/lib/staff/eligible-for-assignment";
import { weekdayInAdminTimezone } from "@/lib/staff/auto-assign";
import { updateRosterSchema, type RosterEntry } from "@/lib/validation/staff-roster-schema";

const SYSTEM_CONFIG_ID = "singleton";

const cellKey = (entry: RosterEntry) => `${entry.userId}|${entry.serviceType}|${entry.dayOfWeek}`;

/**
 * P22 item 8 — ADMIN.md §13 "Roster System" + "Automatic Assignment".
 * Gated by staff.manage (same as Staff / Staff Leave — roster is staff
 * data). GET returns the active staff, every ACTIVE roster cell, and the
 * SystemConfig.autoAssignLeads switch.
 */
export async function GET() {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;

  try {
    const [staff, rows, config, onLeave, offsetMinutes] = await Promise.all([
      db.user.findMany({
        where: { active: true },
        include: { role: { include: { permissions: true } } },
        orderBy: { name: "asc" },
      }),
      db.staffRoster.findMany({ where: { active: true, user: { active: true } }, orderBy: { createdAt: "asc" } }),
      db.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { autoAssignLeads: true } }),
      getStaffIdsOnApprovedLeave(),
      getTimezoneOffsetMinutes(db),
    ]);

    return jsonSuccess({
      autoAssignLeads: config?.autoAssignLeads ?? false,
      todayDayOfWeek: weekdayInAdminTimezone(offsetMinutes),
      staff: staff.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role.name,
        /** Has leads.edit (or admin.full) — only these can actually be auto-assigned. */
        canWorkLeads: isRosterEligible(member),
        /** Empty = unrestricted (Step 39's User.allowedServiceTypes). */
        allowedServiceTypes: member.allowedServiceTypes,
        onLeaveToday: onLeave.has(member.id),
      })),
      entries: rows.map((row) => ({ userId: row.userId, serviceType: row.serviceType, dayOfWeek: row.dayOfWeek })),
    });
  } catch (error) {
    console.error("[api/admin/roster] GET failed", error);
    return jsonError(500, "Couldn't load the roster. Please try again.");
  }
}

/**
 * Bulk replace (see updateRosterSchema). Existing rows that stay ticked are
 * kept as-is (their createdAt is the auto-assign tie-breaker, so they must
 * not be recreated); unticked rows are deleted; newly ticked ones are
 * created or re-activated. Writes one ROSTER_UPDATE audit row, plus an
 * UPDATE row on SystemConfig when the auto-assign switch changes.
 */
export async function PUT(request: NextRequest) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateRosterSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the roster and try again.", parsed.error.flatten().fieldErrors);
  }
  const { userId, entries, autoAssignLeads } = parsed.data;

  try {
    // Scope = the staff whose roster is being replaced: one user, or every active user.
    let scopeUserIds: string[] = [];
    if (entries !== undefined) {
      if (userId) {
        const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!user) return jsonError(404, "Staff member not found.");
        scopeUserIds = [userId];
      } else {
        const activeUsers = await db.user.findMany({ where: { active: true }, select: { id: true } });
        scopeUserIds = activeUsers.map((user) => user.id);
      }
      const scope = new Set(scopeUserIds);
      const outOfScope = entries.filter((entry) => !scope.has(entry.userId));
      if (outOfScope.length > 0) {
        return jsonError(400, "The roster includes a staff member who isn't active any more — refresh and try again.");
      }
    }

    const result = await db.$transaction(async (tx) => {
      let added = 0;
      let removed = 0;
      if (entries !== undefined) {
        const wanted = new Map(entries.map((entry) => [cellKey(entry), entry]));
        const existing = await tx.staffRoster.findMany({ where: { userId: { in: scopeUserIds } } });
        const existingByKey = new Map(existing.map((row) => [cellKey(row), row]));

        const toDelete = existing.filter((row) => !wanted.has(cellKey(row)) && row.active).map((row) => row.id);
        const staleInactive = existing.filter((row) => !wanted.has(cellKey(row)) && !row.active).map((row) => row.id);
        if (toDelete.length > 0 || staleInactive.length > 0) {
          await tx.staffRoster.deleteMany({ where: { id: { in: [...toDelete, ...staleInactive] } } });
        }
        removed = toDelete.length;

        const toReactivate = [...wanted.keys()]
          .map((key) => existingByKey.get(key))
          .filter((row): row is NonNullable<typeof row> => row !== undefined && !row.active)
          .map((row) => row.id);
        if (toReactivate.length > 0) {
          await tx.staffRoster.updateMany({ where: { id: { in: toReactivate } }, data: { active: true } });
        }

        const toCreate = [...wanted.entries()].filter(([key]) => !existingByKey.has(key)).map(([, entry]) => entry);
        if (toCreate.length > 0) {
          await tx.staffRoster.createMany({ data: toCreate.map((entry) => ({ ...entry, active: true })) });
        }
        added = toCreate.length + toReactivate.length;

        await writeAudit(tx, {
          entityType: "StaffRoster",
          entityId: userId ?? "all",
          action: "ROSTER_UPDATE",
          byUserId: session.id,
          note: `Roster ${userId ? "for one staff member" : "grid"} replaced: ${added} shift(s) added, ${removed} removed, ${entries.length} total (by ${session.name})`,
        });
      }

      let autoAssign: boolean | undefined;
      if (autoAssignLeads !== undefined) {
        const before = await tx.systemConfig.findUnique({ where: { id: SYSTEM_CONFIG_ID }, select: { autoAssignLeads: true } });
        const updated = await tx.systemConfig.upsert({
          where: { id: SYSTEM_CONFIG_ID },
          update: { autoAssignLeads },
          create: { id: SYSTEM_CONFIG_ID, autoAssignLeads },
          select: { autoAssignLeads: true },
        });
        autoAssign = updated.autoAssignLeads;
        if ((before?.autoAssignLeads ?? false) !== autoAssignLeads) {
          await writeAudit(tx, {
            entityType: "SystemConfig",
            entityId: SYSTEM_CONFIG_ID,
            action: "UPDATE",
            byUserId: session.id,
            note: `Auto-assign new leads turned ${autoAssignLeads ? "ON" : "OFF"} (by ${session.name})`,
          });
        }
      }

      return { added, removed, autoAssignLeads: autoAssign };
    });

    return jsonSuccess(result);
  } catch (error) {
    console.error("[api/admin/roster] PUT failed", error);
    return jsonError(500, "Couldn't save the roster. Please try again.");
  }
}
