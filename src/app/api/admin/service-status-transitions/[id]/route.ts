import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  const existing = await db.serviceStatusTransition.findUnique({
    where: { id },
    include: { from: true, to: true },
  });
  if (!existing) return jsonError(404, "Transition not found.");

  await db.$transaction(async (tx) => {
    await tx.serviceStatusTransition.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "ServiceStatus",
      entityId: existing.fromStatusId,
      action: "TRANSITION_REMOVE",
      byUserId: session.id,
      note: `Transition removed: "${existing.from.name}" -> "${existing.to.name}" (by ${session.name})`,
    });
  });

  return jsonSuccess({ id });
}
