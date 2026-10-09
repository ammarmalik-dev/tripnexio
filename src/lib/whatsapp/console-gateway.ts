import crypto from "crypto";
import type { DownloadedMedia, SendMessageResult, SendTemplateMessageInput, WhatsAppGateway } from "./gateway";
import { verifyMetaSignature } from "./cloud-api-gateway";
import { maskRecipient } from "../logging/mask";

/**
 * Selected automatically by getWhatsAppGateway() when the WhatsApp Cloud API
 * env vars are unset/still placeholders — same role as MockPaymentGateway/
 * ConsoleEmailSender: exercises the full bot-engine → gateway → "send" path
 * (including the exact same HMAC-SHA256 webhook-signature scheme, just with
 * a locally-generated secret) without real WhatsApp credentials.
 */
export class ConsoleWhatsAppGateway implements WhatsAppGateway {
  readonly providerName = "console (no WHATSAPP_ACCESS_TOKEN configured)";

  /** null = no WHATSAPP_APP_SECRET configured, so every webhook signature is rejected. */
  constructor(private readonly webhookSecret: string | null) {}

  // Logs only the message kind and a masked recipient — never bodies or template parameters (customer data).
  async sendSessionText(to: string): Promise<SendMessageResult> {
    console.log(`[whatsapp:console] session text not delivered (no provider configured) to ${maskRecipient(to)}`);
    return { id: `console_wa_${crypto.randomUUID()}` };
  }

  async sendInteractiveList(to: string): Promise<SendMessageResult> {
    console.log(`[whatsapp:console] interactive list not delivered (no provider configured) to ${maskRecipient(to)}`);
    return { id: `console_wa_${crypto.randomUUID()}` };
  }

  async sendTemplateMessage(to: string, input: SendTemplateMessageInput): Promise<SendMessageResult> {
    console.log(`[whatsapp:console] template "${input.templateName}" not delivered (no provider configured) to ${maskRecipient(to)}`);
    return { id: `console_wa_${crypto.randomUUID()}` };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader || !this.webhookSecret) return false;
    return verifyMetaSignature(rawBody, signatureHeader, this.webhookSecret);
  }

  /** No provider, so no media to fetch. */
  async downloadMedia(): Promise<DownloadedMedia | null> {
    return null;
  }
}
