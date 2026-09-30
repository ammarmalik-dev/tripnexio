import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;
  const reasonResult = await readDeleteReason(request);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

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
      note: withReason(`Transition removed: "${existing.from.name}" -> "${existing.to.name}" (by ${session.name})`, reason),
    });
  });

  return jsonSuccess({ id });
}
