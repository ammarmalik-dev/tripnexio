import type { NextRequest } from "next/server";
import { taskListQuerySchema } from "@/lib/validation/task-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";

/** Staff-facing task inbox (Step 17, audit §3.8) — every Task, auto-created from an existing trigger point (see src/lib/tasks/create-task.ts's callers), optionally filtered. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("tasks.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = taskListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const { status, type, priority, assignedToId, sort, page, pageSize } = parsed.data;

  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(priority ? { priority } : {}),
    ...(assignedToId ? { assignedToId: assignedToId === "unassigned" ? null : assignedToId } : {}),
  };

  const orderBy = sort === "dueDate_asc" ? { dueDate: "asc" as const } : { createdAt: sort === "createdAt_asc" ? ("asc" as const) : ("desc" as const) };

  const [total, tasks] = await Promise.all([
    db.task.count({ where }),
    db.task.findMany({
      where,
      include: {
        lead: true,
        booking: { select: { id: true, bookingId: true } },
        passenger: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = tasks.map((task) => ({
    id: task.id,
    type: task.type,
    priority: task.priority,
    status: task.status,
    title: task.title,
    reason: task.reason,
    serviceType: task.serviceType,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    leadReferenceId: task.lead ? formatLeadReference(task.lead.serviceType, task.lead.id) : null,
    booking: task.booking ? { id: task.booking.id, bookingId: task.booking.bookingId } : null,
    passenger: task.passenger ? { id: task.passenger.id, fullName: task.passenger.fullName } : null,
    assignedTo: task.assignedTo,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}
