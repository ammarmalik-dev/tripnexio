import type { NextRequest } from "next/server";
import { updateStaffUserSchema } from "@/lib/validation/staff-user-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasAnotherActiveAdmin } from "@/lib/auth/admin-guard";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateStaffUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.user.findUnique({ where: { id }, include: { role: { include: { permissions: true } } } });
  if (!existing) return jsonError(404, "Staff account not found.");

  const currentlyAdmin = existing.active && existing.role.permissions.some((permission) => permission.name === ADMIN_FULL_PERMISSION);
  const willDeactivate = parsed.data.active === false;
  let willLoseAdmin = willDeactivate && currentlyAdmin;

  let newRole = existing.role;
  if (parsed.data.roleId && parsed.data.roleId !== existing.roleId) {
    const role = await db.role.findUnique({ where: { id: parsed.data.roleId }, include: { permissions: true } });
    if (!role) return jsonError(400, "Select a valid role.", { roleId: ["This role doesn't exist."] });
    newRole = role;
    const willBeAdmin = role.permissions.some((permission) => permission.name === ADMIN_FULL_PERMISSION);
    if (currentlyAdmin && !willBeAdmin && !willDeactivate) willLoseAdmin = true;
  }

  if (willLoseAdmin && !(await hasAnotherActiveAdmin(id))) {
    return jsonError(409, "This is the last active admin — keep at least one active user with full admin access.");
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.roleId ? { roleId: parsed.data.roleId } : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        ...(parsed.data.allowedServiceTypes !== undefined ? { allowedServiceTypes: parsed.data.allowedServiceTypes } : {}),
      },
      include: { role: true },
    });

    const changeNotes: string[] = [];
    if (parsed.data.name) changeNotes.push(`name -> ${parsed.data.name}`);
    if (parsed.data.roleId && parsed.data.roleId !== existing.roleId) changeNotes.push(`role ${existing.role.name} -> ${newRole.name}`);
    if (parsed.data.active !== undefined && parsed.data.active !== existing.active) {
      changeNotes.push(parsed.data.active ? "reactivated" : "deactivated");
    }
    if (parsed.data.allowedServiceTypes !== undefined) {
      changeNotes.push(
        parsed.data.allowedServiceTypes.length > 0 ? `services scoped to ${parsed.data.allowedServiceTypes.join(", ")}` : "services unrestricted"
      );
    }

    await writeAudit(tx, {
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Staff account "${result.name}" updated: ${changeNotes.join(", ") || "no changes"} (by ${session.name})`,
    });

    return result;
  });

  return jsonSuccess({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    active: updated.active,
    role: { id: updated.role.id, name: updated.role.name },
    allowedServiceTypes: updated.allowedServiceTypes,
  });
}
