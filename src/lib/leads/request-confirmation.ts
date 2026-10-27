import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { buildStatusVariables } from "../notifications/status-template";
import { dropEmptyPlaceholderLines, renderTemplate, tidyRenderedText } from "../notifications/render-template";
import { requestReceivedMessage } from "./request-received-message";

/**
 * Client 2026-10-28 ("submit confirmation whatsapp, mail, website screen tino alag alag he") — the website success
 * screen and the WhatsApp bot's reply show the SAME "request received" message the customer is sent: the client's
 * template of the lead's first ("New") status (NV_COUNTRY_REQUEST_PAYMENT_PENDING, EXT_01, VC_NEW, SF_01, RVT_NEW,
 * OTB_01_NEW…), rendered with the lead's own values. The WhatsApp body is the source (it is the copy submitted to
 * Meta, so it can't drift from what WhatsApp sends); the email body is used when there is no active WhatsApp one.
 * Falls back to request-received-message.ts when the service has no such template.
 */

/** A template body as plain text (no HTML, no half-empty lines) — the way the WhatsApp sender renders it. */
export function renderConfirmationText(body: string, variables: Record<string, string>): string {
  return tidyRenderedText(renderTemplate(dropEmptyPlaceholderLines(body, variables), variables, { escape: false }))
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The per-service text (request-received-message.ts) with the reference, for a service without a "New" template. */
export function fallbackConfirmation(serviceType: ServiceType, referenceId: string): string {
  return `${requestReceivedMessage(serviceType)}\n\nYour reference: ${referenceId}`;
}

/** The "request received" message for a just-created lead. Never throws. */
export async function requestConfirmationMessage(input: { leadId: string; serviceType: ServiceType; referenceId: string }): Promise<string> {
  const fallback = fallbackConfirmation(input.serviceType, input.referenceId);
  try {
    const lead = await db.lead.findUnique({
      where: { id: input.leadId },
      select: { serviceStatus: { select: { notificationEvent: true, customerLabel: true, name: true } } },
    });
    const status = lead?.serviceStatus;
    if (!status?.notificationEvent) return fallback;
    const templates = await db.notificationTemplate.findMany({
      where: { event: status.notificationEvent, active: true },
      select: { channel: true, body: true },
    });
    const template = templates.find((row) => row.channel === "WHATSAPP") ?? templates.find((row) => row.channel === "EMAIL");
    if (!template?.body.trim()) return fallback;
    const variables = await buildStatusVariables("LEAD", input.leadId, {}, status.customerLabel ?? status.name);
    if (!variables) return fallback;
    return renderConfirmationText(template.body, variables) || fallback;
  } catch (error) {
    console.error("[request-confirmation] render failed", error instanceof Error ? error.message : "unknown");
    return fallback;
  }
}
