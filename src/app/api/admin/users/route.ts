import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createStaffUserSchema } from "@/lib/validation/staff-user-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;

  const users = await db.user.findMany({ include: { role: true }, orderBy: { name: "asc" } });

  return jsonSuccess(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      createdAt: user.createdAt,
      role: { id: user.role.id, name: user.role.name },
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createStaffUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existingEmail = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existingEmail) {
    return jsonError(400, "A staff account with this email already exists.", { email: ["This email is taken."] });
  }

  const role = await db.role.findUnique({ where: { id: parsed.data.roleId } });
  if (!role) {
    return jsonError(400, "Select a valid role.", { roleId: ["This role doesn't exist."] });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash, roleId: parsed.data.roleId, active: true },
      include: { role: true },
    });

    await writeAudit(tx, {
      entityType: "User",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Staff account "${created.name}" (${created.email}) created with role ${created.role.name} (by ${session.name})`,
    });

    return created;
  });

  return jsonSuccess(
    { id: user.id, name: user.name, email: user.email, active: user.active, role: { id: user.role.id, name: user.role.name } },
    201
  );
}
