import crypto from "crypto";
import type { SendInteractiveListInput, SendMessageResult, SendTemplateMessageInput, WhatsAppGateway } from "./gateway";
import { verifyMetaSignature } from "./cloud-api-gateway";

/**
 * Selected automatically by getWhatsAppGateway() when the WhatsApp Cloud API
 * env vars are unset/still placeholders — same role as MockPaymentGateway/
 * ConsoleEmailSender: exercises the full bot-engine → gateway → "send" path
 * (including the exact same HMAC-SHA256 webhook-signature scheme, just with
 * a locally-generated secret) without real WhatsApp credentials.
 */
export class ConsoleWhatsAppGateway implements WhatsAppGateway {
  readonly providerName = "console (no WHATSAPP_ACCESS_TOKEN configured)";

  constructor(private readonly webhookSecret: string) {}

  async sendSessionText(to: string, body: string): Promise<SendMessageResult> {
    console.log(`[whatsapp:console] session text to ${to}\n---\n${body}\n---`);
    return { id: `console_wa_${crypto.randomUUID()}` };
  }

  async sendInteractiveList(to: string, input: SendInteractiveListInput): Promise<SendMessageResult> {
    const rows = input.sections.flatMap((section) => section.rows.map((row) => `${row.id}: ${row.title}`));
    console.log(`[whatsapp:console] interactive list to ${to}\n---\n${input.bodyText}\n[${input.buttonText}]\n${rows.join("\n")}\n---`);
    return { id: `console_wa_${crypto.randomUUID()}` };
  }

  async sendTemplateMessage(to: string, input: SendTemplateMessageInput): Promise<SendMessageResult> {
    console.log(
      `[whatsapp:console] template "${input.templateName}" (${input.languageCode}) to ${to}\nParameters: ${JSON.stringify(input.bodyParameters)}`
    );
    return { id: `console_wa_${crypto.randomUUID()}` };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    return verifyMetaSignature(rawBody, signatureHeader, this.webhookSecret);
  }
}
