import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { getLeadRelatedEntityRefs } from "@/lib/leads/related-entities";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMAIL_AUDIT_ACTIONS = ["EMAIL_SENT", "EMAIL_SKIPPED", "EMAIL_FAILED"];
/** The WhatsApp chat that led to a request starts a little before the lead exists. */
const CHAT_LEAD_IN_MS = 2 * 60 * 60 * 1000;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * CRM.md §25 (Step 18, audit §3.7) — a unified per-lead communications
 * timeline. Email history is read from the existing AuditTrail
 * EMAIL_SENT/EMAIL_SKIPPED/EMAIL_FAILED rows (scoped to this lead's own
 * entities via the same helper the Activity Timeline uses — see
 * getLeadRelatedEntityRefs's own doc comment) rather than a new table.
 * WhatsApp history reads WhatsAppMessageLog by the customer's derived
 * waId — that model has no leadId/customerId FK of its own (it's a flat
 * per-number log, shared by the bot across every conversation with that
 * number), so this is scoped by waId, not by a relation.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const lead = await db.lead.findUnique({ where: { id }, include: { customer: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(auth.session, lead.serviceType);
  if (scopeError) return scopeError;

  const entityRefs = await getLeadRelatedEntityRefs(id);
  const emailAuditRows = entityRefs.length
    ? await db.auditTrail.findMany({
        where: { OR: entityRefs, action: { in: EMAIL_AUDIT_ACTIONS } },
        include: { byUser: true },
        orderBy: { timestamp: "asc" },
      })
    : [];

  const waId = toWhatsAppId(lead.customer.mobile);
  const [conversation, whatsappMessages, nextLead] = await Promise.all([
    db.whatsAppConversation.findUnique({ where: { waId } }),
    db.whatsAppMessageLog.findMany({ where: { waId }, include: { sentByUser: true }, orderBy: { createdAt: "asc" } }),
    db.lead.findFirst({ where: { customerId: lead.customerId, createdAt: { gt: lead.createdAt } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  // Client testing 2026-10-09 (E6) — this request's own WhatsApp messages: from a
  // little before it was created (the chat that led to it) until the customer's
  // next request. Everything else is returned separately as history.
  const windowStart = lead.createdAt.getTime() - CHAT_LEAD_IN_MS;
  const windowEnd = nextLead ? nextLead.createdAt.getTime() - CHAT_LEAD_IN_MS : Number.POSITIVE_INFINITY;
  const inThisRequest = (at: Date) => at.getTime() >= windowStart && at.getTime() < windowEnd;

  const windowOpen = Boolean(
    conversation?.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < WHATSAPP_SESSION_WINDOW_MS
  );
  const windowExpiresAt =
    conversation?.lastInboundAt && windowOpen ? new Date(conversation.lastInboundAt.getTime() + WHATSAPP_SESSION_WINDOW_MS) : null;

  const emailItems = emailAuditRows.map((row) => ({
    id: row.id,
    channel: "EMAIL" as const,
    direction: "OUTBOUND" as const,
    status: row.action as "EMAIL_SENT" | "EMAIL_SKIPPED" | "EMAIL_FAILED",
    body: row.note,
    sentBy: row.byUser?.name ?? null,
    timestamp: row.timestamp,
  }));

  const toItem = (message: (typeof whatsappMessages)[number]) => ({
    id: message.id,
    channel: "WHATSAPP" as const,
    direction: message.direction,
    status: null,
    body: message.body,
    sentBy: message.sentByUser?.name ?? null,
    timestamp: message.createdAt,
  });
  const whatsappItems = whatsappMessages.filter((message) => inThisRequest(message.createdAt)).map(toItem);
  const history = whatsappMessages.filter((message) => !inThisRequest(message.createdAt)).map(toItem);

  const items = [...emailItems, ...whatsappItems].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return jsonSuccess({
    customer: { email: lead.customer.email, mobile: lead.customer.mobile },
    whatsapp: { windowOpen, windowExpiresAt },
    items,
    history,
  });
}
