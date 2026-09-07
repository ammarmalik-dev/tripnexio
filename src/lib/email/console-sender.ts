import crypto from "crypto";
import type { EmailSender, SendEmailInput, SendEmailResult } from "./sender";

/**
 * Selected automatically by getEmailSender() when RESEND_API_KEY is
 * unset/still a placeholder (see .env.example) — lets the full
 * template-lookup -> variable-substitution -> send -> AuditTrail pipeline be
 * exercised end-to-end in dev without a real Resend account (the client
 * hasn't provided one yet). Never actually delivers anything — logs the
 * rendered email to the server console so it can still be inspected, and
 * every AuditTrail note this produces names "console" as the provider so
 * it's never mistaken for a real send.
 */
export class ConsoleEmailSender implements EmailSender {
  readonly providerName = "console (no RESEND_API_KEY configured)";

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const id = `console_${crypto.randomUUID()}`;
    console.log(
      `[email:console] would send to ${input.to}\nSubject: ${input.subject}\n` +
        (input.attachments?.length ? `Attachments: ${input.attachments.map((a) => a.filename).join(", ")}\n` : "") +
        `---\n${input.html}\n---`
    );
    return { id };
  }
}
