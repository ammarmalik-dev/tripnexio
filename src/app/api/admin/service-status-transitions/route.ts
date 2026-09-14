import type { NextRequest } from "next/server";
import { createServiceStatusTransitionSchema } from "@/lib/validation/service-status-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/** ADMIN.md §17: "Admin configures... status transitions... per service/sub-service." */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createServiceStatusTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.fromStatusId === parsed.data.toStatusId) {
    return jsonError(400, "A status can't transition to itself.");
  }

  const [fromStatus, toStatus] = await Promise.all([
    db.serviceStatus.findUnique({ where: { id: parsed.data.fromStatusId } }),
    db.serviceStatus.findUnique({ where: { id: parsed.data.toStatusId } }),
  ]);
  if (!fromStatus || !toStatus) return jsonError(404, "One of these statuses doesn't exist.");
  if (fromStatus.serviceType !== toStatus.serviceType || fromStatus.scope !== toStatus.scope) {
    return jsonError(400, "Both statuses must belong to the same service and scope.");
  }

  const existing = await db.serviceStatusTransition.findUnique({
    where: { fromStatusId_toStatusId: { fromStatusId: parsed.data.fromStatusId, toStatusId: parsed.data.toStatusId } },
  });
  if (existing) return jsonSuccess(existing, 201);

  const transition = await db.$transaction(async (tx) => {
    const created = await tx.serviceStatusTransition.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "ServiceStatus",
      entityId: fromStatus.id,
      action: "TRANSITION_ADD",
      byUserId: session.id,
      note: `Transition added: "${fromStatus.name}" -> "${toStatus.name}" (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(transition, 201);
}
