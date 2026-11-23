import { db } from "../db";
import { getEmailSender } from "../email/get-sender";
import type { EmailAttachment } from "../email/sender";
import { escapeHtml } from "../html/escape";
import { siteConfig } from "../site-config";
import { resolveRecipients, type NotifyStaffInput } from "./notify";

/**
 * Client doc 16 Nov (N2 / N10–N12) — staff alerts go by email: plain, internal, never through the customer
 * templates. Recipients are resolved like in-app notifications (explicit users and / or a permission, service-scoped).
 * Never throws.
 */
export async function sendStaffEmail(input: {
  recipients: NotifyStaffInput["recipients"];
  subject: string;
  /** Plain lines; each becomes a paragraph (escaped). */
  lines: string[];
  /** A CRM path for the "Open in CRM" link. */
  link?: string;
  /** Prebuilt HTML (already escaped) placed after the lines, e.g. a summary table. */
  extraHtml?: string;
  attachments?: EmailAttachment[];
}): Promise<number> {
  try {
    const ids = await resolveRecipients(input.recipients);
    if (ids.length === 0) return 0;
    const users = await db.user.findMany({ where: { id: { in: ids }, active: true }, select: { email: true } });
    const html = [
      ...input.lines.map((line) => `<p style="margin:0 0 10px">${escapeHtml(line)}</p>`),
      input.extraHtml ?? "",
      input.link ? `<p><a href="${siteConfig.url}${input.link}">Open in CRM</a></p>` : "",
      `<p style="color:#6b7280;font-size:12px">Internal TripNexio alert — not sent to customers.</p>`,
    ].join("");
    let sent = 0;
    for (const user of users) {
      try {
        await getEmailSender().send({ to: user.email, subject: `[TripNexio] ${input.subject}`, html, attachments: input.attachments });
        sent++;
      } catch (error) {
        console.error("[staff-email] send failed", error instanceof Error ? error.message : "error");
      }
    }
    return sent;
  } catch (error) {
    console.error("[staff-email]", error instanceof Error ? error.message : "error");
    return 0;
  }
}
