import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { writeAudit } from "@/lib/audit/log";
import { POST_TICKET_OFFER_TASK_TITLE } from "@/lib/cross-sell/post-ticket";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * P15 — the customer's "No thanks" to the post-ticket Return Ticket / OTB
 * offer. Stored per lead (Lead.crossSellOptOut) so the offer isn't repeated
 * in that journey; the open staff follow-up task is closed too.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const limited = await rateLimitByIp(request, "cross-sell-opt-out", { limit: 20, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return jsonError(404, "Page not found.");

  const booking = await db.booking.findUnique({ where: { customerToken: token }, select: { id: true, leadId: true, lead: { select: { crossSellOptOut: true } } } });
  if (!booking) return jsonError(404, "Page not found.");
  if (booking.lead.crossSellOptOut) return jsonSuccess({ optedOut: true });

  try {
    await db.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: booking.leadId }, data: { crossSellOptOut: true } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: booking.leadId,
        action: "CROSS_SELL_OPT_OUT",
        note: "Customer declined the post-ticket Return Ticket / OTB offer",
      });
      const tasks = await tx.task.findMany({
        where: { leadId: booking.leadId, title: POST_TICKET_OFFER_TASK_TITLE, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { id: true },
      });
      for (const task of tasks) {
        await tx.task.update({ where: { id: task.id }, data: { status: "CANCELLED" } });
        await writeAudit(tx, { entityType: "Task", entityId: task.id, action: "AUTO_CANCEL", note: "Customer declined the offer" });
      }
    });
    return jsonSuccess({ optedOut: true });
  } catch (error) {
    console.error("[api/pay/cross-sell-opt-out]", error);
    return jsonError(500, "Couldn't save your choice. Please try again.");
  }
}
