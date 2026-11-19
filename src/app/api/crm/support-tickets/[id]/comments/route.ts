import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getStaffSession } from "@/lib/auth/staff-session";
import { findVisibleTicket } from "@/lib/support/ticket-access";
import { notifyStaff } from "@/lib/staff-notifications/notify";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const commentSchema = z.object({ body: z.string().trim().min(2, "Write a comment").max(2000, "Keep it under 2000 characters") });

/** Client doc 16 Nov (L3) — a comment on a ticket (the raiser or a manager); the other side is notified in-app. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");
  const { id } = await params;
  const ticket = await findVisibleTicket(session, id);
  if (!ticket) return jsonError(404, "Ticket not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const comment = await db.$transaction(async (tx) => {
      const created = await tx.supportTicketComment.create({
        data: { ticketId: id, authorId: session.id, body: parsed.data.body },
        include: { author: { select: { name: true } } },
      });
      await tx.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } });
      await writeAudit(tx, { entityType: "SupportTicket", entityId: id, action: "COMMENT", byUserId: session.id, note: `Comment on ${ticket.ticketNumber} (by ${session.name})` });
      return created;
    });
    const full = await db.supportTicket.findUnique({ where: { id }, select: { raisedById: true, assignedToId: true } });
    const recipients = [full?.raisedById, full?.assignedToId].filter((userId): userId is string => Boolean(userId) && userId !== session.id);
    if (recipients.length > 0) {
      await notifyStaff({
        type: "SUPPORT_TICKET",
        title: `New comment on ticket ${ticket.ticketNumber}`,
        body: parsed.data.body.slice(0, 200),
        link: `/crm/help?ticket=${id}`,
        entityType: "SupportTicket",
        entityId: id,
        recipients: { userIds: [...new Set(recipients)] },
      });
    }
    return jsonSuccess(comment, 201);
  } catch (error) {
    console.error("[support-tickets] comment failed", describeError(error));
    return jsonError(500, "Couldn't add the comment.");
  }
}
