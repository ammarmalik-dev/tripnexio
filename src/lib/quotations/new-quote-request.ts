import type { Prisma } from "../../generated/prisma/client";
import { writeAudit } from "../audit/log";
import { NEW_QUOTE_TASK_TITLE } from "./flight-quote";

/**
 * P15 — once staff answer a customer's "Request New Quote" (a new quotation
 * or a revalidated one), the open task closes and the lead flag clears.
 * A no-op when nothing was requested.
 */
export async function resolveNewQuoteRequest(tx: Prisma.TransactionClient, leadId: string, note: string): Promise<void> {
  const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { details: true } });
  const details = (lead?.details ?? {}) as Record<string, unknown>;
  const tasks = await tx.task.findMany({
    where: { leadId, title: NEW_QUOTE_TASK_TITLE, status: { in: ["OPEN", "IN_PROGRESS"] } },
    select: { id: true },
  });
  if (tasks.length === 0 && typeof details.newQuoteRequestedAt !== "string") return;

  for (const task of tasks) {
    await tx.task.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await writeAudit(tx, { entityType: "Task", entityId: task.id, action: "AUTO_COMPLETE", note });
  }
  if (typeof details.newQuoteRequestedAt === "string") {
    const { newQuoteRequestedAt: _requestedAt, ...rest } = details;
    void _requestedAt;
    await tx.lead.update({ where: { id: leadId }, data: { details: rest as Prisma.InputJsonValue } });
  }
}
