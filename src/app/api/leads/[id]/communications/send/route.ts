import type { NextRequest } from "next/server";
import { sendCommunicationSchema } from "@/lib/validation/communication-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { getEmailSender } from "@/lib/email/get-sender";
import { getWhatsAppGateway } from "@/lib/whatsapp/get-gateway";
import { toWhatsAppId } from "@/lib/whatsapp/phone";

const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Manual send from the Communications module (Step 18, audit §3.7) — a
 * one-off, staff-composed message, not a NotificationTemplate-driven
 * automated one. EMAIL has no 24h-style constraint (email has no session
 * window); WHATSAPP can only ever send a freeform session message here
 * (never a Meta-approved template — a template's wording is fixed and
 * pre-approved, so there's no sensible way to fit arbitrary staff-authored
 * text into one), so it's rejected outside the 24h window instead of
 * attempting a template send.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = sendCommunicationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id }, include: { customer: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;

  if (parsed.data.channel === "EMAIL") {
    if (!lead.customer.email) {
      return jsonError(400, "This customer has no email on file.");
    }

    try {
      const sender = getEmailSender();
      const result = await sender.send({
        to: lead.customer.email,
        subject: parsed.data.subject,
        html: parsed.data.body.replace(/\n/g, "<br>"),
      });
      await writeAudit(db, {
        entityType: "Lead",
        entityId: id,
        action: "EMAIL_SENT",
        byUserId: session.id,
        note: `"${parsed.data.subject}" manually sent to ${lead.customer.email} via ${sender.providerName}${result.id ? ` (id ${result.id})` : ""} (by ${session.name})`,
      });
    } catch (error) {
      await writeAudit(db, {
        entityType: "Lead",
        entityId: id,
        action: "EMAIL_FAILED",
        byUserId: session.id,
        note: `Manual email "${parsed.data.subject}" to ${lead.customer.email} failed: ${error instanceof Error ? error.message : "unknown error"} (by ${session.name})`,
      });
      return jsonError(502, "Couldn't send that email. It's been recorded as failed — please try again.");
    }

    return jsonSuccess({ channel: "EMAIL" });
  }

  const waId = toWhatsAppId(lead.customer.mobile);
  const conversation = await db.whatsAppConversation.findUnique({ where: { waId } });
  const windowOpen = Boolean(
    conversation?.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() < WHATSAPP_SESSION_WINDOW_MS
  );
  if (!windowOpen) {
    return jsonError(
      409,
      "This customer hasn't messaged on WhatsApp in the last 24 hours, so a freeform message can't be delivered — only a Meta-approved template can reach them outside that window."
    );
  }

  const gateway = getWhatsAppGateway();
  await gateway.sendSessionText(waId, parsed.data.body);

  const message = await db.whatsAppMessageLog.create({
    data: { waId, direction: "OUTBOUND", body: parsed.data.body, sentByUserId: session.id },
  });
  await writeAudit(db, {
    entityType: "Lead",
    entityId: id,
    action: "WHATSAPP_SENT",
    byUserId: session.id,
    note: `WhatsApp message manually sent to ${waId} via ${gateway.providerName} (by ${session.name})`,
  });

  return jsonSuccess({ channel: "WHATSAPP", messageId: message.id });
}
