import type { NextRequest } from "next/server";
import { taskListQuerySchema } from "@/lib/validation/task-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { isServiceScopeUnrestricted, assertServiceAccess } from "@/lib/auth/service-scope";
import { createManualTaskSchema } from "@/lib/validation/manual-task-schema";
import { writeAudit } from "@/lib/audit/log";
import type { ServiceType } from "@/generated/prisma/enums";
import { leadReference } from "@/lib/leads/reference";

/** Staff-facing task inbox (Step 17, audit §3.8) — every Task, auto-created from an existing trigger point (see src/lib/tasks/create-task.ts's callers), optionally filtered. */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("tasks.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = taskListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const { status, type, priority, assignedToId, dateFrom, dateTo, sort, page, pageSize } = parsed.data;

  // Task.serviceType is nullable (denormalized, not every trigger can
  // resolve one) — a null-serviceType task is never hidden by scoping,
  // since there's nothing to check it against; only a resolved one is
  // actually filtered.
  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(priority ? { priority } : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(assignedToId ? { assignedToId: assignedToId === "unassigned" ? null : assignedToId } : {}),
    ...(!isServiceScopeUnrestricted(auth.session)
      ? { OR: [{ serviceType: null }, { serviceType: { in: auth.session.allowedServiceTypes } }] }
      : {}),
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
    leadReferenceId: task.lead ? leadReference(task.lead) : null,
    booking: task.booking ? { id: task.booking.id, bookingId: task.booking.bookingId } : null,
    passenger: task.passenger ? { id: task.passenger.id, fullName: task.passenger.fullName } : null,
    assignedTo: task.assignedTo,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}

/**
 * P22 item 4 — manual task creation (Tasks page "New task", Lead/Booking
 * detail "Add task"). `type` is always MANUAL; entityType/entityId/
 * serviceType are derived server-side from `leadId`/`bookingId` (never
 * trusted from the client), falling back to the creating User for a
 * free-standing task. Service scope is enforced on the linked lead.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("tasks.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createManualTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;
  const leadIdInput = input.leadId || undefined;
  const bookingIdInput = input.bookingId || undefined;
  const assignedToId = input.assignedToId || null;
  const reason = input.reason || null;
  const dueDate = input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null;

  try {
    let entityType = "User";
    let entityId = session.id;
    let leadId: string | null = null;
    let bookingId: string | null = null;
    let serviceType: ServiceType | null = null;

    if (bookingIdInput) {
      const booking = await db.booking.findUnique({
        where: { id: bookingIdInput },
        select: { id: true, leadId: true, lead: { select: { serviceType: true } } },
      });
      if (!booking) return jsonError(404, "Booking not found.");
      const scopeError = assertServiceAccess(session, booking.lead.serviceType);
      if (scopeError) return scopeError;
      entityType = "Booking";
      entityId = booking.id;
      bookingId = booking.id;
      leadId = booking.leadId;
      serviceType = booking.lead.serviceType;
    } else if (leadIdInput) {
      const lead = await db.lead.findUnique({ where: { id: leadIdInput }, select: { id: true, serviceType: true } });
      if (!lead) return jsonError(404, "Lead not found.");
      const scopeError = assertServiceAccess(session, lead.serviceType);
      if (scopeError) return scopeError;
      entityType = "Lead";
      entityId = lead.id;
      leadId = lead.id;
      serviceType = lead.serviceType;
    }

    let assigneeName: string | null = null;
    if (assignedToId) {
      const assignee = await db.user.findUnique({ where: { id: assignedToId }, select: { name: true, active: true } });
      if (!assignee || !assignee.active) {
        return jsonError(400, "Select a valid, active staff member.", { assignedToId: ["This staff member isn't available."] });
      }
      assigneeName = assignee.name;
    }

    const task = await db.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          type: "MANUAL",
          priority: input.priority,
          title: input.title,
          reason,
          entityType,
          entityId,
          leadId,
          bookingId,
          serviceType,
          assignedToId,
          dueDate,
        },
      });
      await writeAudit(tx, {
        entityType: "Task",
        entityId: created.id,
        action: "CREATE",
        byUserId: session.id,
        note: `Manual task "${created.title}" created on ${entityType} ${entityId}${
          assigneeName ? `, assigned to ${assigneeName}` : ""
        } (by ${session.name})`,
      });
      return created;
    });

    return jsonSuccess(task, 201);
  } catch (error) {
    console.error("[tasks] manual task creation failed", error instanceof Error ? error.message : "unknown");
    return jsonError(500, "Couldn't create the task. Please try again.");
  }
}
