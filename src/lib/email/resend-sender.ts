import { Resend } from "resend";
import type { EmailSender, SendEmailInput, SendEmailResult } from "./sender";

/**
 * Real implementation, selected by getEmailSender() once RESEND_API_KEY is a
 * real (non-placeholder) value — see get-sender.ts. Uses Resend's own
 * `emails.send` call directly rather than any templating feature of theirs;
 * template storage/rendering stays in our own NotificationTemplate model
 * (Admin-managed) so it works the same regardless of which provider sends it.
 */
export class ResendEmailSender implements EmailSender {
  readonly providerName = "resend";
  private readonly client: Resend;

  constructor(apiKey: string, private readonly fromAddress: string) {
    this.client = new Resend(apiKey);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const { data, error } = await this.client.emails.send({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
    });

    if (error) {
      throw new Error(`Resend send failed (${error.name}): ${error.message}`);
    }

    return { id: data?.id ?? null };
  }
}
