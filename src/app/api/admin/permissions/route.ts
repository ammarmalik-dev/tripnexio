import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("roles.manage");
  if (auth.error) return auth.error;

  const permissions = await db.permission.findMany({ orderBy: { name: "asc" } });
  return jsonSuccess(permissions.map((permission) => ({ id: permission.id, name: permission.name, description: permission.description })));
}
