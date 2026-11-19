import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { canManageTickets } from "@/lib/support/ticket-access";
import { describeError } from "@/lib/api/describe-error";
import type { Prisma } from "@/generated/prisma/client";
import type { SupportTicketStatus } from "@/generated/prisma/enums";

const STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

/**
 * Client doc 16 Nov (L3) — help desk tickets. `scope=mine` (default): the signed-in staff member's own tickets (CRM
 * Help). `scope=all`: every ticket, for the managers (Admin → Support Tickets), filterable by status / assignee / text.
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");
  const params = new URL(request.url).searchParams;
  const all = params.get("scope") === "all";
  if (all && !canManageTickets(session)) return jsonError(403, "You don't have access to every ticket.");

  const status = params.get("status");
  const assignedTo = params.get("assignedTo");
  const search = params.get("search")?.trim();
  const where: Prisma.SupportTicketWhereInput = {
    ...(all ? {} : { raisedById: session.id }),
    ...(status && (STATUSES as string[]).includes(status) ? { status: status as SupportTicketStatus } : {}),
    ...(all && assignedTo ? { assignedToId: assignedTo === "unassigned" ? null : assignedTo } : {}),
    ...(search
      ? { OR: [{ ticketNumber: { contains: search, mode: "insensitive" } }, { title: { contains: search, mode: "insensitive" } }] }
      : {}),
  };
  try {
    const tickets = await db.supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        raisedBy: { select: { name: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    });
    return jsonSuccess(tickets);
  } catch (error) {
    console.error("[support-tickets] list failed", describeError(error));
    return jsonError(500, "Couldn't load the tickets.");
  }
}
