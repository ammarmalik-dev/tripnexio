import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getStaffSession } from "@/lib/auth/staff-session";
import { canManageTickets, findVisibleTicket } from "@/lib/support/ticket-access";
import { SUPPORT_TICKET_STATUS_LABELS } from "@/lib/support/tickets";
import { notifyStaff } from "@/lib/staff-notifications/notify";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Client doc 16 Nov (L3) — one ticket with its comments, attachments and history (raiser or a manager). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");
  const { id } = await params;
  if (!(await findVisibleTicket(session, id))) return jsonError(404, "Ticket not found.");
  try {
    const [ticket, history] = [
      await db.supportTicket.findUniqueOrThrow({
        where: { id },
        include: {
          raisedBy: { select: { name: true, email: true } },
          assignedTo: { select: { id: true, name: true } },
          comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
          attachments: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
        },
      }),
      await db.auditTrail.findMany({
        where: { entityType: "SupportTicket", entityId: id },
        orderBy: { timestamp: "asc" },
        take: 200,
        select: { id: true, action: true, note: true, timestamp: true },
      }),
    ];
    return jsonSuccess({ ...ticket, history, canManage: canManageTickets(session) });
  } catch (error) {
    console.error("[support-tickets] detail failed", describeError(error));
    return jsonError(500, "Couldn't load the ticket.");
  }
}

const updateSchema = z
  .object({
    assignedToId: z.string().trim().min(1).nullable().optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
    resolutionNote: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.status !== "RESOLVED" || (data.resolutionNote?.length ?? 0) >= 5, {
    message: "Write a resolution note (at least 5 characters) to resolve the ticket",
    path: ["resolutionNote"],
  });

/** Managers: assign, change the status (Resolved needs a resolution note), audited; the raiser and assignee are told. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");
  if (!canManageTickets(session)) return jsonError(403, "Only the help desk managers can update a ticket.");
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  try {
    const ticket = await db.supportTicket.findUnique({ where: { id }, select: { id: true, ticketNumber: true, title: true, status: true, assignedToId: true, raisedById: true } });
    if (!ticket) return jsonError(404, "Ticket not found.");
    let assigneeName: string | null = null;
    if (input.assignedToId) {
      const assignee = await db.user.findFirst({ where: { id: input.assignedToId, active: true }, select: { name: true } });
      if (!assignee) return jsonError(400, "Select an active staff member.", { assignedToId: ["This staff member isn't available."] });
      assigneeName = assignee.name;
    }

    const changes: string[] = [];
    const data: { assignedToId?: string | null; status?: "OPEN" | "IN_PROGRESS" | "RESOLVED"; resolutionNote?: string; resolvedAt?: Date | null } = {};
    if (input.assignedToId !== undefined && input.assignedToId !== ticket.assignedToId) {
      data.assignedToId = input.assignedToId;
      changes.push(input.assignedToId ? `assigned to ${assigneeName}` : "unassigned");
    }
    if (input.status && input.status !== ticket.status) {
      data.status = input.status;
      data.resolvedAt = input.status === "RESOLVED" ? new Date() : null;
      if (input.status === "RESOLVED") data.resolutionNote = input.resolutionNote;
      changes.push(`${SUPPORT_TICKET_STATUS_LABELS[ticket.status]} → ${SUPPORT_TICKET_STATUS_LABELS[input.status]}${input.status === "RESOLVED" ? ` — ${input.resolutionNote}` : ""}`);
    }
    if (changes.length === 0) return jsonSuccess({ id, changed: false });

    await db.$transaction(async (tx) => {
      await tx.supportTicket.update({ where: { id }, data });
      await writeAudit(tx, {
        entityType: "SupportTicket",
        entityId: id,
        action: data.status ? "STATUS_CHANGE" : "ASSIGN",
        byUserId: session.id,
        note: `Ticket ${ticket.ticketNumber}: ${changes.join("; ")} (by ${session.name})`,
      });
    });
    // After the commit: the person who raised it, and a newly assigned staff member.
    const recipients = [ticket.raisedById, ...(data.assignedToId ? [data.assignedToId] : [])].filter((userId) => userId !== session.id);
    if (recipients.length > 0) {
      await notifyStaff({
        type: "SUPPORT_TICKET",
        title: `Ticket ${ticket.ticketNumber} updated: ${changes.join("; ")}`.slice(0, 300),
        link: `/crm/help?ticket=${id}`,
        entityType: "SupportTicket",
        entityId: id,
        recipients: { userIds: recipients },
      });
    }
    return jsonSuccess({ id, changed: true });
  } catch (error) {
    console.error("[support-tickets] update failed", describeError(error));
    return jsonError(500, "Couldn't update the ticket.");
  }
}
