import type { Prisma } from "../../generated/prisma/client";
import type { ServiceType, TaskPriority, TaskType } from "../../generated/prisma/enums";
import { writeAudit } from "../audit/log";

export interface CreateTaskInput {
  type: TaskType;
  priority?: TaskPriority;
  title: string;
  reason?: string;
  /** Polymorphic link to whatever triggered this task — see Task's own schema comment. */
  entityType: string;
  entityId: string;
  leadId?: string | null;
  bookingId?: string | null;
  passengerId?: string | null;
  serviceType?: ServiceType | null;
  dueDate?: Date | null;
}

/**
 * Creates a CRM Task from an existing trigger point (Step 17, audit §3.8) —
 * called from wherever the detection logic already exists (a document
 * flagged MISSING, an OCR extraction landing PENDING_REVIEW, a quotation
 * about to expire) rather than this module re-detecting any of those
 * conditions itself. Accepts either a `db` client or an open `tx` — most
 * call sites are already inside a $transaction alongside the state change
 * that triggered the task, but the quote-expiry automation job isn't (see
 * sendNotificationEmail's own doc comment for the same non-transactional
 * pattern, used there for the same reason: this runs after its own
 * surrounding logic already committed).
 */
export async function createTask(tx: Prisma.TransactionClient, input: CreateTaskInput) {
  const task = await tx.task.create({
    data: {
      type: input.type,
      priority: input.priority ?? "NORMAL",
      title: input.title,
      reason: input.reason,
      entityType: input.entityType,
      entityId: input.entityId,
      leadId: input.leadId ?? undefined,
      bookingId: input.bookingId ?? undefined,
      passengerId: input.passengerId ?? undefined,
      serviceType: input.serviceType ?? undefined,
      dueDate: input.dueDate ?? undefined,
    },
  });

  await writeAudit(tx, {
    entityType: "Task",
    entityId: task.id,
    action: "CREATE",
    note: `${task.title} (auto-created from ${input.entityType} ${input.entityId})`,
  });

  return task;
}

/**
 * Closes out any still-open task(s) tied to the same trigger entity once
 * the underlying condition that created them resolves — e.g. a document
 * moving off MISSING, or an OCR extraction getting confirmed/rejected.
 * Deliberately additive per the roadmap prompt: this only ever touches the
 * Task rows this module itself created, never the entity's own status or
 * audit trail.
 */
export async function autoCompleteTasksForEntity(
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  note: string
): Promise<number> {
  const openTasks = await tx.task.findMany({
    where: { entityType, entityId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });

  for (const task of openTasks) {
    await tx.task.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await writeAudit(tx, { entityType: "Task", entityId: task.id, action: "AUTO_COMPLETE", note });
  }

  return openTasks.length;
}
