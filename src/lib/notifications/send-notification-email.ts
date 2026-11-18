import { db } from "../db";
import { DELIVERY_EVENT_PATTERN, disclaimerHtml, formatDeliveryBody, importantInfoHtml } from "../email/delivery-blocks";
import { importantInfoFor, OUTPUT_IMPORTANT_INFO } from "../outputs/output-notes";
import type { OutputType } from "../outputs/output-types";
import { ctaFor } from "./cta";
import { emailButtonHtml } from "../email/layout";
import { writeAudit } from "../audit/log";
import { getEmailSender } from "../email/get-sender";
import { dropEmptyPlaceholderLines, renderTemplate, tidyRenderedText, withRequiredLines } from "./render-template";
import { emailHeroFor } from "./email-hero";
import type { EmailAttachment } from "../email/sender";
import { withOneRetry } from "./retry";

/**
 * Client corrections 2026-10-05: every email that delivers a service output
 * (visa approval, ticket issued, extended visa, reservation, package, OTB
 * confirmation) carries this note, in the client's wording (corrected).
 */
export const OUTPUT_DISCREPANCY_NOTE =
  "Please cross-check your details against your ID proof. If you notice any discrepancy, let us know within 24 hours. Corrections after that may be chargeable.";
const OUTPUT_EVENTS = new Set<string>(["OUTPUT_DELIVERED", "OTB_APPROVED"]);

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

    const subject = tidyRenderedText(renderTemplate(template.subject ?? event, variables, { escape: false }));
    // Client 2026-10-14 — the event's link (Pay Now, Download…) is a button, not a bare URL.
    const cta = ctaFor(event, variables, template);
    const CTA_MARKER = "@@TN_CTA@@";
    // Client doc 2026-10-20 — a line with nothing filled in is left out, never sent as "Reason: ".
    let bodyText = dropEmptyPlaceholderLines(withRequiredLines(template.body, variables), variables);
    if (cta) {
      const placeholder = new RegExp(`\\{\\{\\s*${cta.variable}\\s*\\}\\}`, "g");
      bodyText = placeholder.test(bodyText) ? bodyText.replace(placeholder, CTA_MARKER) : `${bodyText}\n${CTA_MARKER}`;
    }
    const body = tidyRenderedText(renderTemplate(bodyText, variables))
      .replace(/\n/g, "<br>")
      .replace(CTA_MARKER, cta ? emailButtonHtml(cta.label, cta.url) : "")
      .replaceAll(CTA_MARKER, "");
    // Client doc 2026-10-27 (D12) — also for a status-template output email (Visa Change package), unless already in the body.
    const info = importantInfoFor(event, variables.outputType, body);
    // Client doc 16 Nov (M2) — delivery emails: the opening line set apart, Important Information with its own
    // heading style and the disclaimer in a separate box.
    const isDelivery = Boolean(info) || OUTPUT_EVENTS.has(event) || DELIVERY_EVENT_PATTERN.test(event);
    const html = info
      ? `${formatDeliveryBody(body)}${importantInfoHtml(info)}`
      : OUTPUT_EVENTS.has(event) && !OUTPUT_IMPORTANT_INFO[variables.outputType as OutputType]
        ? `${formatDeliveryBody(body)}${disclaimerHtml([OUTPUT_DISCREPANCY_NOTE])}`
        : isDelivery
          ? formatDeliveryBody(body)
          : body;

    const sender = getEmailSender();
    const hero = await emailHeroFor(event, auditTarget, variables, template.heading);
    const result = await withOneRetry(() => sender.send({ to, subject, html, attachments, hero }));

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
