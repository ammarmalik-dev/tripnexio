import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { seesAllRecords } from "@/lib/auth/ownership";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { ABANDONED_DRAFT_SOURCE } from "@/lib/leads/abandoned-draft";

const LIST_SIZE = 30;

/**
 * Client doc 2026-10-20 (G3 / G4) — CRM → WhatsApp Chats: the latest WhatsApp conversations, chats with the
 * team ("HANDED_OFF") first, each with its lead and the customer's open booking so the agent replies with the
 * booking at hand. Staff without `leads.reassign` see only chats whose lead is theirs or unassigned.
 */
export async function GET() {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;
  const { session } = auth;

  try {
    const conversations = await db.whatsAppConversation.findMany({
      where: { lastInboundAt: { not: null } },
      orderBy: { lastInboundAt: "desc" },
      take: LIST_SIZE * 2,
    });
    const rows = [];
    for (const conversation of conversations) {
      // Client doc 2026-10-27 (G1) — a near-match on the last 10 digits with a different number is "no customer", not a
      // reason to hide the chat (the conversation's own lead still shows it).
      const matched = await db.customer.findFirst({ where: { mobile: { contains: conversation.waId.slice(-10) } }, select: { id: true, name: true, mobile: true } });
      const customer = matched && toWhatsAppId(matched.mobile) === conversation.waId ? matched : null;
      const leadSelect = { id: true, reference: true, serviceType: true, assignedStaffId: true, assignedStaff: { select: { name: true } } } as const;
      const lead = conversation.leadId
        ? await db.lead.findUnique({ where: { id: conversation.leadId }, select: leadSelect })
        : customer
          ? await db.lead.findFirst({ where: { customerId: customer.id, source: { not: ABANDONED_DRAFT_SOURCE } }, orderBy: { createdAt: "desc" }, select: leadSelect })
          : null;
      if (!lead) continue;
      if (!seesAllRecords(session) && lead.assignedStaffId && lead.assignedStaffId !== session.id) continue;
      const booking = customer
        ? await db.booking.findFirst({
            where: { customerId: customer.id, status: { notIn: ["CANCELLED", "COMPLETED", "REFUNDED"] } },
            orderBy: { createdAt: "desc" },
            select: { id: true, bookingId: true },
          })
        : null;
      const last = await db.whatsAppMessageLog.findFirst({ where: { waId: conversation.waId }, orderBy: { createdAt: "desc" }, select: { body: true, direction: true, createdAt: true } });
      rows.push({
        waId: conversation.waId,
        customerName: customer?.name ?? conversation.customerName ?? `+${conversation.waId}`,
        withTeam: conversation.state === "HANDED_OFF",
        lastInboundAt: conversation.lastInboundAt,
        lastMessage: last ? { body: last.body.slice(0, 160), direction: last.direction, at: last.createdAt } : null,
        lead: { id: lead.id, reference: lead.reference, serviceType: lead.serviceType, poc: lead.assignedStaff?.name ?? null },
        booking,
      });
      if (rows.length >= LIST_SIZE) break;
    }
    rows.sort((a, b) => Number(b.withTeam) - Number(a.withTeam));
    return jsonSuccess(rows);
  } catch (error) {
    console.error("[crm/whatsapp-chats]", error instanceof Error ? error.message : "error");
    return jsonError(500, "Couldn't load the chats. Please try again.");
  }
}
