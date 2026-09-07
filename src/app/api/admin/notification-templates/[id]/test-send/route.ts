import type { NextRequest } from "next/server";
import { testSendNotificationTemplateSchema } from "@/lib/validation/notification-template-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { sendNotificationEmail } from "@/lib/notifications/send-notification-email";
import { sendNotificationWhatsApp } from "@/lib/notifications/send-notification-whatsapp";
import { NOTIFICATION_EVENT_CATALOG } from "@/lib/notifications/events";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lets an admin verify a saved EMAIL or WHATSAPP template actually sends —
 * fills in the event's documented sample variables (NOTIFICATION_EVENT_CATALOG)
 * rather than real customer data. EMAIL sends via whichever provider
 * getEmailSender() currently selects (ConsoleEmailSender until real Resend
 * keys are set); WHATSAPP sends via getWhatsAppGateway(), and additionally
 * requires `metaTemplateName` to already be filled in on the template (the
 * same requirement a real trigger has — there's no way to test-send an
 * unapproved WhatsApp template, Meta itself would reject it). Tests the
 * persisted template, not unsaved form edits — save first.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = testSendNotificationTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const template = await db.notificationTemplate.findUnique({ where: { id } });
  if (!template) return jsonError(404, "Notification template not found.");
  if (!template.active) {
    return jsonError(409, "Enable this template before sending a test.");
  }

  const catalogEntry = NOTIFICATION_EVENT_CATALOG.find((entry) => entry.event === template.event);
  const sampleVariables = catalogEntry?.sampleVariables ?? { customerName: "Sample Customer" };

  if (template.channel === "EMAIL") {
    if (!EMAIL_RE.test(parsed.data.to)) {
      return jsonError(400, "Enter a valid email address.", { to: ["Enter a valid email address."] });
    }
    await sendNotificationEmail({
      event: template.event,
      to: parsed.data.to,
      variables: sampleVariables,
      auditTarget: { entityType: "NotificationTemplate", entityId: template.id },
    });
    return jsonSuccess({ sent: true });
  }

  if (!template.metaTemplateName?.trim()) {
    return jsonError(409, "Set the Meta-approved template name before sending a test — Meta will reject an unapproved template either way.");
  }
  await sendNotificationWhatsApp({
    event: template.event,
    to: toWhatsAppId(parsed.data.to),
    variables: sampleVariables,
    auditTarget: { entityType: "NotificationTemplate", entityId: template.id },
  });
  return jsonSuccess({ sent: true });
}
