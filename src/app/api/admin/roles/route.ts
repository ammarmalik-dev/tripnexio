import type { NextRequest } from "next/server";
import { createRoleSchema } from "@/lib/validation/role-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("roles.manage");
  if (auth.error) return auth.error;

  const roles = await db.role.findMany({
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return jsonSuccess(
    roles.map((role) => ({
      id: role.id,
      name: role.name,
      userCount: role._count.users,
      permissions: role.permissions.map((permission) => permission.name),
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("roles.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.role.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return jsonError(400, "A role with this name already exists.", { name: ["This name is taken."] });
  }

  const role = await db.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        name: parsed.data.name,
        permissions: { connect: parsed.data.permissionNames.map((name) => ({ name })) },
      },
      include: { permissions: true },
    });

    await writeAudit(tx, {
      entityType: "Role",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Role "${created.name}" created with permissions: ${parsed.data.permissionNames.join(", ") || "none"} (by ${session.name})`,
    });

    return created;
  });

  return jsonSuccess({ id: role.id, name: role.name, permissions: role.permissions.map((permission) => permission.name) }, 201);
}
