import type { NextRequest } from "next/server";
import { updateTaskStatusSchema } from "@/lib/validation/task-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertValidTaskTransition } from "@/lib/tasks/transitions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("tasks.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateTaskStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return jsonError(404, "Task not found.");
  // task.serviceType is nullable (denormalized, not every trigger can
  // resolve one) — a null-serviceType task is never scope-checked.
  if (task.serviceType) {
    const scopeError = assertServiceAccess(session, task.serviceType);
    if (scopeError) return scopeError;
  }

  const transitionError = assertValidTaskTransition(task.status, parsed.data.status);
  if (transitionError) return jsonError(409, transitionError);

  const isCompleting = parsed.data.status === "COMPLETED";

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.task.update({
      where: { id },
      data: {
        status: parsed.data.status,
        completedAt: isCompleting ? new Date() : task.completedAt,
        completedByUserId: isCompleting ? session.id : task.completedByUserId,
      },
    });
    await writeAudit(tx, {
      entityType: "Task",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `${task.status} -> ${parsed.data.status}${parsed.data.note ? `: ${parsed.data.note}` : ""} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
