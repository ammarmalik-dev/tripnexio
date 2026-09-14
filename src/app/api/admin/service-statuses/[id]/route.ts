import type { NextRequest } from "next/server";
import { updateServiceStatusSchema } from "@/lib/validation/service-status-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateServiceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.serviceStatus.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Status not found.");

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const nameTaken = await db.serviceStatus.findUnique({
      where: { serviceType_scope_name: { serviceType: existing.serviceType, scope: existing.scope, name: parsed.data.name } },
    });
    if (nameTaken) return jsonError(400, "A status with this name already exists for this service.", { name: ["This name is taken."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.serviceStatus.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "ServiceStatus",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Status "${result.name}" updated (by ${session.name})`,
    });
    return result;
  });

  const transitions = await db.serviceStatusTransition.findMany({ where: { fromStatusId: id }, select: { id: true, toStatusId: true } });
  return jsonSuccess({ ...updated, transitions });
}
