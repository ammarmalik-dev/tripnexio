import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getWhatsAppGateway } from "../whatsapp/get-gateway";
import { renderTemplate, withRequiredLines } from "./render-template";

/** Meta lets a business send free-text messages for 24 hours after the customer's last message. */
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface NotificationAuditTarget {
  entityType: string;
  entityId: string;
}

export interface SendNotificationWhatsAppInput {
  /** A NOTIFICATION_EVENTS constant at every real trigger site — kept as `string` for the same reason as the email dispatcher (an Admin "Send Test" action needs to pass an arbitrary saved template's own event value). */
  event: string;
  /** The customer's WhatsApp id (digits, country code, no `+`) — see src/lib/whatsapp/phone.ts. Null/undefined is a normal case (no mobile on file), not an error. */
  to: string | null | undefined;
  variables: Record<string, string>;
  auditTarget: NotificationAuditTarget;
}

/** Extracts `{{var}}` names from a template body, in the order they first appear — WhatsApp Message Templates take POSITIONAL {{1}}, {{2}}… parameters, so our named-placeholder body has to be flattened into an ordered array to match. */
function extractOrderedVariableNames(body: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  return ordered;
}

/**
 * WhatsApp counterpart to sendNotificationEmail() — same never-throws,
 * always-audits contract. The key difference: outside an active 24h
 * customer session, WhatsApp Cloud API requires a Meta-APPROVED Message
 * Template (not our own free-text body) — so this looks up
 * `metaTemplateName`/`metaTemplateLanguage` on the NotificationTemplate row
 * and skips (audited, not silently dropped) when they're not yet
 * configured. See the model's schema comment and
 * docs/deployment/WHATSAPP_SETUP.md.
 */
export async function sendNotificationWhatsApp(input: SendNotificationWhatsAppInput): Promise<void> {
  const { event, to, variables, auditTarget } = input;

  if (!to) {
    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "WHATSAPP_SKIPPED",
      note: `${event}: customer has no mobile number on file`,
    });
    return;
  }

  try {
    const template = await db.notificationTemplate.findUnique({
      where: { event_channel: { event, channel: "WHATSAPP" } },
    });
    if (!template || !template.active) {
      await writeAudit(db, {
        entityType: auditTarget.entityType,
        entityId: auditTarget.entityId,
        action: "WHATSAPP_SKIPPED",
        note: `${event}: no active WHATSAPP template configured`,
      });
      return;
    }
    // Client feedback 2026-10-07 — inside the customer's 24h session window
    // (they messaged us on WhatsApp in the last 24 hours) Meta allows a normal
    // free-text message, so send the template body as text even when no
    // Meta-approved template is set up yet. Outside the window a template is
    // required (below).
    const conversation = await db.whatsAppConversation.findUnique({ where: { waId: to }, select: { lastInboundAt: true } });
    if (conversation?.lastInboundAt && conversation.lastInboundAt.getTime() > Date.now() - SESSION_WINDOW_MS) {
      const text = renderTemplate(withRequiredLines(template.body, variables), variables, { escape: false })
        .replace(/<[^>]+>/g, "")
        .trim();
      const gateway = getWhatsAppGateway();
      const result = await gateway.sendSessionText(to, text);
      await writeAudit(db, {
        entityType: auditTarget.entityType,
        entityId: auditTarget.entityId,
        action: "WHATSAPP_SENT",
        note: `${event} sent to ${to} via ${gateway.providerName} (24h session message)${result.id ? ` (id ${result.id})` : ""}`,
      });
      return;
    }

    if (!template.metaTemplateName || !template.metaTemplateName.trim()) {
      await writeAudit(db, {
        entityType: auditTarget.entityType,
        entityId: auditTarget.entityId,
        action: "WHATSAPP_SKIPPED",
        note: `${event}: template has no Meta-approved template name yet — register it in Meta Business Manager and set it in the Admin template editor`,
      });
      return;
    }

    const orderedVariableNames = extractOrderedVariableNames(template.body);
    const bodyParameters = orderedVariableNames.map((name) => variables[name] ?? "");

    const gateway = getWhatsAppGateway();
    const result = await gateway.sendTemplateMessage(to, {
      templateName: template.metaTemplateName,
      languageCode: template.metaTemplateLanguage?.trim() || "en",
      bodyParameters,
    });

    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "WHATSAPP_SENT",
      note: `${event} sent to ${to} via ${gateway.providerName} (template ${template.metaTemplateName})${result.id ? ` (id ${result.id})` : ""}`,
    });
  } catch (error) {
    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "WHATSAPP_FAILED",
      note: `${event} to ${to} failed: ${error instanceof Error ? error.message : "unknown error"}`,
    });
  }
}
