import type { NextRequest } from "next/server";
import { updateTaskAssignmentSchema } from "@/lib/validation/task-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

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

  const parsed = updateTaskAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return jsonError(404, "Task not found.");

  let staffName: string | null = null;
  if (parsed.data.assignedToId) {
    const staff = await db.user.findUnique({ where: { id: parsed.data.assignedToId } });
    if (!staff || !staff.active) {
      return jsonError(400, "Select a valid, active staff member.", { assignedToId: ["This staff member isn't available."] });
    }
    staffName = staff.name;
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.task.update({ where: { id }, data: { assignedToId: parsed.data.assignedToId } });
    await writeAudit(tx, {
      entityType: "Task",
      entityId: id,
      action: "ASSIGN",
      byUserId: session.id,
      note: staffName ? `Assigned to ${staffName} (by ${session.name})` : `Unassigned (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
