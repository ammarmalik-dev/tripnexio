import { db } from "../db";
import { writeAudit } from "../audit/log";
import { getSmsSender } from "../sms/get-sender";
import { renderTemplate } from "./render-template";
import type { NotificationAuditTarget } from "./send-notification-email";

export interface SendNotificationSmsInput {
  event: string;
  /** The customer's phone number, if we have one on file — null/undefined is a normal, expected case, not an error. */
  to: string | null | undefined;
  variables: Record<string, string>;
  auditTarget: NotificationAuditTarget;
}

/**
 * Third notification channel alongside sendNotificationEmail/
 * sendNotificationWhatsApp — same shape, same never-throws contract, same
 * SMS-channel NotificationTemplate lookup. No SMS templates are seeded for
 * any event yet (per Item 11's own scope — "don't fabricate SMS copy
 * yourself"), so every event correctly SMS_SKIPs until an Admin adds real
 * SMS templates at /admin/notification-templates.
 */
export async function sendNotificationSms(input: SendNotificationSmsInput): Promise<void> {
  const { event, to, variables, auditTarget } = input;

  if (!to) {
    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "SMS_SKIPPED",
      note: `${event}: customer has no phone number on file`,
    });
    return;
  }

  try {
    const template = await db.notificationTemplate.findUnique({
      where: { event_channel: { event, channel: "SMS" } },
    });
    if (!template || !template.active) {
      await writeAudit(db, {
        entityType: auditTarget.entityType,
        entityId: auditTarget.entityId,
        action: "SMS_SKIPPED",
        note: `${event}: no active SMS template configured`,
      });
      return;
    }

    const body = renderTemplate(template.body, variables);

    const sender = getSmsSender();
    const result = await sender.send({ to, body });

    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "SMS_SENT",
      note: `${event} sent to ${to} via ${sender.providerName}${result.id ? ` (id ${result.id})` : ""}`,
    });
  } catch (error) {
    await writeAudit(db, {
      entityType: auditTarget.entityType,
      entityId: auditTarget.entityId,
      action: "SMS_FAILED",
      note: `${event} to ${to} failed: ${error instanceof Error ? error.message : "unknown error"}`,
    });
  }
}
