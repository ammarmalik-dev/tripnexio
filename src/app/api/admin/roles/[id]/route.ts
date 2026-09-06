import type { NextRequest } from "next/server";
import { updateRoleSchema } from "@/lib/validation/role-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("roles.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.role.findUnique({
    where: { id },
    include: { permissions: true, users: { where: { active: true } } },
  });
  if (!existing) return jsonError(404, "Role not found.");

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const nameTaken = await db.role.findUnique({ where: { name: parsed.data.name } });
    if (nameTaken) {
      return jsonError(400, "A role with this name already exists.", { name: ["This name is taken."] });
    }
  }

  // Guard: never let an edit strip admin.full from the only role keeping at least one active admin user.
  const currentlyGrantsAdminFull = existing.permissions.some((permission) => permission.name === ADMIN_FULL_PERMISSION);
  const willGrantAdminFull = parsed.data.permissionNames?.includes(ADMIN_FULL_PERMISSION) ?? currentlyGrantsAdminFull;
  if (currentlyGrantsAdminFull && !willGrantAdminFull && existing.users.length > 0) {
    const otherActiveAdmins = await db.user.count({
      where: { active: true, roleId: { not: id }, role: { permissions: { some: { name: ADMIN_FULL_PERMISSION } } } },
    });
    if (otherActiveAdmins === 0) {
      return jsonError(409, "This would leave no active admin user — keep admin.full on at least one role with an active user.");
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.role.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.permissionNames
          ? { permissions: { set: parsed.data.permissionNames.map((name) => ({ name })) } }
          : {}),
      },
      include: { permissions: true },
    });

    await writeAudit(tx, {
      entityType: "Role",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Role "${result.name}" updated — permissions now: ${result.permissions.map((p) => p.name).join(", ") || "none"} (by ${session.name})`,
    });

    return result;
  });

  return jsonSuccess({ id: updated.id, name: updated.name, permissions: updated.permissions.map((permission) => permission.name) });
}
