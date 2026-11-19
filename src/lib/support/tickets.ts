import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getEmailSender } from "../email/get-sender";
import { escapeHtml } from "../html/escape";
import { notifyStaff } from "../staff-notifications/notify";
import { sendSystemAlert } from "../automation/system-alert";
import type { TaskPriority } from "../../generated/prisma/enums";

/** Client doc 16 Nov (L3) — who manages the help desk (Admin → Support Tickets): the staff managers / Admin. */
export const SUPPORT_TICKET_MANAGER_PERMISSION = "staff.manage";

export const SUPPORT_TICKET_STATUS_LABELS = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" } as const;

/** The n-th ticket's number: TNIT0001 … TNIT9999, then TNIT10000 … (never reused). */
export function supportTicketNumber(sequence: number): string {
  return `TNIT${String(Math.max(1, Math.floor(sequence))).padStart(4, "0")}`;
}

export interface NewTicketInput {
  title: string;
  description: string;
  pageUrl?: string;
  priority: TaskPriority;
  /** Already-stored uploads (see the route): /api/files URL + what the staff member picked. */
  attachments: { fileName: string; fileUrl: string; mimeType: string; sizeBytes: number }[];
}

/**
 * Creates the ticket with the next TNIT number (race-safe through the shared counter table), its attachments and the
 * audit row; then — after the commit — emails the person who raised it, alerts the managers in-app and the system
 * alert inbox. Notifications never fail the ticket.
 */
export async function createSupportTicket(raiser: { id: string; name: string }, input: NewTicketInput) {
  const ticket = await db.$transaction(async (tx) => {
    const counter = await tx.$queryRaw<{ lastValue: number }[]>`
      INSERT INTO "ReferenceCounter" ("period", "lastValue", "updatedAt")
      VALUES ('SUPPORT_TICKET', 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("period") DO UPDATE SET "lastValue" = "ReferenceCounter"."lastValue" + 1, "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "lastValue"`;
    const created = await tx.supportTicket.create({
      data: {
        ticketNumber: supportTicketNumber(Number(counter[0]?.lastValue ?? 1)),
        title: input.title,
        description: input.description,
        pageUrl: input.pageUrl || null,
        priority: input.priority,
        raisedById: raiser.id,
        attachments: { create: input.attachments.map((file) => ({ ...file, uploadedById: raiser.id })) },
      },
      select: { id: true, ticketNumber: true, title: true },
    });
    await writeAudit(tx, {
      entityType: "SupportTicket",
      entityId: created.id,
      action: "CREATE",
      byUserId: raiser.id,
      note: `Ticket ${created.ticketNumber} "${created.title}" raised from the CRM Help page${input.attachments.length ? ` with ${input.attachments.length} attachment(s)` : ""} (by ${raiser.name})`,
    });
    return created;
  });

  await notifyTicketCreated(ticket, raiser);
  return ticket;
}

async function notifyTicketCreated(ticket: { id: string; ticketNumber: string; title: string }, raiser: { id: string; name: string }) {
  const link = `/admin/support-tickets?ticket=${ticket.id}`;
  await notifyStaff({
    type: "SUPPORT_TICKET",
    title: `New support ticket ${ticket.ticketNumber}: ${ticket.title}`,
    body: `Raised by ${raiser.name}.`,
    link,
    entityType: "SupportTicket",
    entityId: ticket.id,
    recipients: { permission: SUPPORT_TICKET_MANAGER_PERMISSION },
  });
  await sendSystemAlert(`New support ticket ${ticket.ticketNumber}`, `${raiser.name} raised "${ticket.title}". Open Admin → Support Tickets to assign it.`);
  try {
    const user = await db.user.findUnique({ where: { id: raiser.id }, select: { email: true } });
    if (user?.email) {
      await getEmailSender().send({
        to: user.email,
        subject: `Ticket ${ticket.ticketNumber} received — ${ticket.title}`,
        html: `<p>Hi ${escapeHtml(raiser.name)},</p><p>Your support ticket <strong>${escapeHtml(ticket.ticketNumber)}</strong> — “${escapeHtml(ticket.title)}” — has been received. The admin team will look into it; you can follow it on the CRM Help page.</p>`,
      });
    }
  } catch (error) {
    console.error("[support-tickets] confirmation email failed", error instanceof Error ? error.name : "error");
  }
}
