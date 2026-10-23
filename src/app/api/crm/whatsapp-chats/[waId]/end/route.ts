import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { seesAllRecords } from "@/lib/auth/ownership";
import { writeAudit } from "@/lib/audit/log";

interface RouteParams {
  params: Promise<{ waId: string }>;
}

/**
 * Client doc 2026-10-20 (G4: "keep the chat accessible until the conversation is finished") — the agent ends a
 * chat the team took over: the conversation goes back to the bot (its next message gets the menu again) and the
 * chat no longer shows as "Wants an agent". The message history stays.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { waId } = await params;
  try {
    const conversation = await db.whatsAppConversation.findUnique({ where: { waId } });
    if (!conversation) return jsonError(404, "Chat not found.");
    if (conversation.state !== "HANDED_OFF") return jsonError(409, "This chat isn't with the team.");

    if (!seesAllRecords(session) && conversation.leadId) {
      const lead = await db.lead.findUnique({ where: { id: conversation.leadId }, select: { assignedStaffId: true } });
      if (lead?.assignedStaffId && lead.assignedStaffId !== session.id) return jsonError(403, "This chat belongs to another team member.");
    }

    await db.$transaction(async (tx) => {
      await tx.whatsAppConversation.update({ where: { waId }, data: { state: "COMPLETED", serviceType: null, collectedFields: {} } });
      await writeAudit(tx, {
        entityType: conversation.leadId ? "Lead" : "WhatsAppConversation",
        entityId: conversation.leadId ?? conversation.id,
        action: "WHATSAPP_CHAT_ENDED",
        byUserId: session.id,
        note: `WhatsApp chat with +${waId} ended — handed back to the bot (by ${session.name})`,
      });
    });
    return jsonSuccess({ ended: true });
  } catch (error) {
    console.error("[crm/whatsapp-chats/end]", error instanceof Error ? error.message : "error");
    return jsonError(500, "Couldn't end the chat. Please try again.");
  }
}
