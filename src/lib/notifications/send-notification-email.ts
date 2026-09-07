import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getEmailSender } from "../email/get-sender";
import { renderTemplate } from "./render-template";
import type { EmailAttachment } from "../email/sender";

export interface NotificationAuditTarget {
  entityType: string;
  entityId: string;
}

export interface SendNotificationEmailInput {
  /**
   * A NOTIFICATION_EVENTS constant at every real trigger call site (kept as
   * `string` here, not that narrower union, so the Admin "Send Test" action
   * can also pass an arbitrary staff-authored template's own `event` value —
   * NotificationTemplate.event is deliberately a free string, see the model's
   * schema comment).
   */
  event: string;
  /** The customer's email, if we have one on file — null/undefined is a normal, expected case (mobile-only customers), not an error. */
  to: string | null | undefined;
  variables: Record<string, string>;
  auditTarget: NotificationAuditTarget;
  attachments?: EmailAttachment[];
}

/**
 * Looks up the active EMAIL NotificationTemplate for `event`, renders it
 * with `variables`, and sends it via whichever provider getEmailSender()
 * currently selects. Deliberately never throws — a notification is a
 * side effect of a business operation (lead created, payment succeeded,
 * …), and a broken/misconfigured template or a provider outage must never
 * roll back or fail that operation. Every outcome (skipped, sent, failed)
 * is written to AuditTrail against `auditTarget` instead, using `db`
 * directly rather than a `tx` — this always runs after the triggering
 * transaction has already committed.
 */
export async function sendNotificationEmail(input: SendNotificationEmailInput): Promise<void> {
  const { event, to, variables, auditTarget, attachments } = input;

  if (!to) {
    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "EMAIL_SKIPPED",
      note: `${event}: customer has no email on file`,
    });
    return;
  }

  try {
    const template = await db.notificationTemplate.findUnique({
      where: { event_channel: { event, channel: "EMAIL" } },
    });
    if (!template || !template.active) {
      await writeAudit(db, {
        entityType: auditTarget.entityType,
        entityId: auditTarget.entityId,
        action: "EMAIL_SKIPPED",
        note: `${event}: no active EMAIL template configured`,
      });
      return;
    }

    const subject = renderTemplate(template.subject ?? event, variables);
    const html = renderTemplate(template.body, variables).replace(/\n/g, "<br>");

    const sender = getEmailSender();
    const result = await sender.send({ to, subject, html, attachments });

    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "EMAIL_SENT",
      note: `${event} sent to ${to} via ${sender.providerName}${result.id ? ` (id ${result.id})` : ""}`,
    });
  } catch (error) {
    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "EMAIL_FAILED",
      note: `${event} to ${to} failed: ${error instanceof Error ? error.message : "unknown error"}`,
    });
  }
}
