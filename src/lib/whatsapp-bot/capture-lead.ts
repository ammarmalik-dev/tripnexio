import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { describeError } from "../api/describe-error";
import { createLeadFromSubmission } from "../leads/create-lead";
import { notifyStaff } from "../staff-notifications/notify";
import { SERVICE_TYPE_LABELS } from "../crm/labels";

const OPEN_LEAD_DAYS = 7;
const CLOSED_STATUSES = ["CONVERTED", "LOST", "CLOSED"] as const;
/** A chat message alerts the POC again only after this long without a fresh, unread alert. */
const CHAT_ALERT_COOLDOWN_MS = 5 * 60 * 1000;

async function customerIdForWaId(waId: string): Promise<string | null> {
  const customer = await db.customer.findFirst({ where: { mobile: { contains: waId.slice(-10) } }, select: { id: true } });
  return customer?.id ?? null;
}

/** An open WhatsApp lead of this customer from the last week, so a repeated "agent" doesn't create duplicates. */
async function recentOpenWhatsAppLead(customerId: string | null) {
  if (!customerId) return null;
  return db.lead.findFirst({
    where: {
      customerId,
      source: "WhatsApp Bot",
      status: { notIn: [...CLOSED_STATUSES] },
      createdAt: { gte: new Date(Date.now() - OPEN_LEAD_DAYS * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

interface ChatTarget {
  entityType: "Booking" | "Lead";
  entityId: string;
  leadId: string;
  link: string;
  pocId: string | null;
  serviceType: ServiceType;
  reference: string;
}

/**
 * Client doc 2026-10-20 (G3 / G4) — where staff answer this chat: the customer's latest open booking (so the
 * agent has it open while chatting, no searching), else the given lead. The alert goes to that record's POC.
 */
async function chatTarget(customerId: string | null, leadId: string | null): Promise<ChatTarget | null> {
  const booking = customerId
    ? await db.booking.findFirst({
        where: { customerId, status: { notIn: ["CANCELLED", "COMPLETED", "REFUNDED"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, bookingId: true, leadId: true, lead: { select: { assignedStaffId: true, serviceType: true } } },
      })
    : null;
  if (booking) {
    return {
      entityType: "Booking",
      entityId: booking.id,
      leadId: booking.leadId,
      link: `/crm/bookings/${booking.id}#tab-communication`,
      pocId: booking.lead.assignedStaffId,
      serviceType: booking.lead.serviceType,
      reference: booking.bookingId,
    };
  }
  if (!leadId) return null;
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, reference: true, serviceType: true, assignedStaffId: true } });
  if (!lead) return null;
  return {
    entityType: "Lead",
    entityId: lead.id,
    leadId: lead.id,
    link: `/crm/leads/${lead.id}#tab-communication`,
    pocId: lead.assignedStaffId,
    serviceType: lead.serviceType,
    reference: lead.reference ?? "new request",
  };
}

const recipientsFor = (target: ChatTarget) =>
  target.pocId ? { userIds: [target.pocId] } : { permission: "leads.view", serviceType: target.serviceType };

/**
 * Client feedback 2026-10-07 — a WhatsApp customer who asks for an agent
 * must reach a person: make sure there's a lead staff can reply from (its
 * Communications tab shows the chat), and tell the team now. Reuses an open
 * WhatsApp lead from the last week; otherwise creates one through the normal
 * intake pipeline (which also assigns a POC and notifies staff). Client doc
 * 2026-10-20 (G3 / G4) — the alert goes to the POC and opens the customer's
 * booking (or lead) on its chat tab; the conversation remembers that lead for
 * CRM → WhatsApp Chats. Never throws.
 */
export async function captureWhatsAppHandoff(input: {
  waId: string;
  profileName: string | null;
  serviceType: ServiceType | null;
  collected: Record<string, string>;
}): Promise<void> {
  try {
    const target = await ensureChatTarget(input);
    if (!target) {
      await notifyUnlinkedChat(input.waId, input.profileName, `${input.profileName ?? `+${input.waId}`} wants to talk to an agent.`);
      return;
    }
    await notifyStaff({
      type: "WHATSAPP_CHAT",
      title: `WhatsApp: ${input.profileName ?? `+${input.waId}`} wants to talk to an agent (${target.reference})`,
      body: `${SERVICE_TYPE_LABELS[target.serviceType]}. Reply from the chat tab — it's open on the ${target.entityType === "Booking" ? "booking" : "lead"}.`,
      link: target.link,
      entityType: target.entityType,
      entityId: target.entityId,
      recipients: recipientsFor(target),
    });
  } catch (error) {
    console.error("[whatsapp-bot] handoff lead capture failed", describeError(error));
    await notifyUnlinkedChat(input.waId, input.profileName, `${input.profileName ?? `+${input.waId}`} wants to talk to an agent.`);
  }
}

/**
 * The record staff answer this chat from — the customer's open booking, the conversation's lead or an open WhatsApp
 * lead — creating a lead through the normal intake pipeline when there is none, and remembering it on the
 * conversation (CRM → WhatsApp Chats lists a chat by its lead).
 */
async function ensureChatTarget(input: { waId: string; profileName: string | null; serviceType: ServiceType | null; collected: Record<string, string> }): Promise<ChatTarget | null> {
  const customerId = await customerIdForWaId(input.waId);
  const conversation = await db.whatsAppConversation.findUnique({ where: { waId: input.waId }, select: { leadId: true } });
  const conversationLead = conversation?.leadId
    ? await db.lead.findFirst({ where: { id: conversation.leadId, status: { notIn: [...CLOSED_STATUSES] } }, select: { id: true } })
    : null;
  let leadId = (await recentOpenWhatsAppLead(customerId))?.id ?? conversationLead?.id ?? null;
  let target = await chatTarget(customerId, leadId);
  if (!target) {
    const result = await createLeadFromSubmission({
      serviceType: input.serviceType ?? "OTHER",
      source: "WhatsApp Bot",
      contact: { fullName: input.collected.fullName || input.profileName || "WhatsApp customer", mobile: input.waId, email: input.collected.email ?? "" },
      details: {
        ...input.collected,
        whatsappHandoff: true,
        requestedAgentAt: new Date().toISOString(),
        ...(input.serviceType ? {} : { otherServiceDescription: "Asked to talk to an agent on WhatsApp" }),
      },
    });
    leadId = result.leadId;
    target = await chatTarget(await customerIdForWaId(input.waId), leadId);
  }
  if (!target) return null;
  if (conversation?.leadId !== target.leadId) {
    await db.whatsAppConversation.update({ where: { waId: input.waId }, data: { leadId: target.leadId } });
  }
  return target;
}

/**
 * Client doc 2026-10-27 (G1) — a chat that couldn't be tied to a lead / booking still reaches people: everyone who
 * can reassign leads (managers, admins) is alerted with a link to CRM → WhatsApp Chats. Never throws.
 */
async function notifyUnlinkedChat(waId: string, profileName: string | null, body: string): Promise<void> {
  try {
    await notifyStaff({
      type: "WHATSAPP_CHAT",
      title: `WhatsApp message from ${profileName ?? `+${waId}`}`,
      body: body.slice(0, 200),
      link: "/crm/whatsapp",
      entityType: "WhatsAppConversation",
      entityId: waId,
      recipients: { permission: "leads.reassign" },
    });
  } catch (error) {
    console.error("[whatsapp-bot] unlinked chat alert failed", describeError(error));
  }
}

/**
 * Client doc 2026-10-20 (G3 / G5) — while a chat is with the team the bot stays quiet, so each customer
 * message alerts the POC instead (at most once per few minutes while an alert is still unread). Never throws.
 */
export async function notifyWhatsAppChatMessage(input: { waId: string; profileName: string | null; text: string }): Promise<void> {
  try {
    const conversation = await db.whatsAppConversation.findUnique({ where: { waId: input.waId }, select: { leadId: true, serviceType: true } });
    // Client doc 2026-10-27 (G1) — the handover may not have produced a lead (e.g. its capture failed): make one now
    // so the chat shows in the CRM, and alert managers when even that isn't possible.
    let target = await chatTarget(await customerIdForWaId(input.waId), conversation?.leadId ?? null);
    if (!target) {
      target = await ensureChatTarget({ waId: input.waId, profileName: input.profileName, serviceType: conversation?.serviceType ?? null, collected: {} }).catch((error: unknown) => {
        console.error("[whatsapp-bot] chat lead capture failed", describeError(error));
        return null;
      });
    }
    if (!target) {
      const recentUnlinked = await db.staffNotification.findFirst({
        where: { type: "WHATSAPP_CHAT", entityId: input.waId, readAt: null, createdAt: { gte: new Date(Date.now() - CHAT_ALERT_COOLDOWN_MS) } },
        select: { id: true },
      });
      if (!recentUnlinked) await notifyUnlinkedChat(input.waId, input.profileName, input.text);
      return;
    }
    const recent = await db.staffNotification.findFirst({
      where: { type: "WHATSAPP_CHAT", entityId: target.entityId, readAt: null, createdAt: { gte: new Date(Date.now() - CHAT_ALERT_COOLDOWN_MS) } },
      select: { id: true },
    });
    if (recent) return;
    await notifyStaff({
      type: "WHATSAPP_CHAT",
      title: `WhatsApp message from ${input.profileName ?? `+${input.waId}`} (${target.reference})`,
      body: input.text.slice(0, 200),
      link: target.link,
      entityType: target.entityType,
      entityId: target.entityId,
      recipients: recipientsFor(target),
    });
  } catch (error) {
    console.error("[whatsapp-bot] chat message alert failed", describeError(error));
  }
}
