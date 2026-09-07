export interface SendTemplateMessageInput {
  /** The exact name of a Meta-approved WhatsApp Message Template. */
  templateName: string;
  /** e.g. "en" or "en_US" — must match what was approved in Meta Business Manager. */
  languageCode: string;
  /** Positional {{1}}, {{2}}, … body parameters, in order. */
  bodyParameters: string[];
}

export interface SendMessageResult {
  id: string | null;
}

/**
 * Service-layer interface for outbound WhatsApp — mirrors PaymentGateway/
 * EmailSender's shape so it can be swapped later without touching call
 * sites. Two send modes because WhatsApp Cloud API itself has two:
 * - sendSessionText: freeform text, only deliverable within 24h of the
 *   customer's last inbound message (the bot conversation lives entirely
 *   inside this window, since the customer just messaged us).
 * - sendTemplateMessage: a Meta-APPROVED template, required to reach a
 *   customer OUTSIDE that window (every CRM-triggered notification, e.g.
 *   PAYMENT_RECEIVED for a lead that came from the website, not WhatsApp).
 */
export interface WhatsAppGateway {
  readonly providerName: string;
  sendSessionText(to: string, body: string): Promise<SendMessageResult>;
  sendTemplateMessage(to: string, input: SendTemplateMessageInput): Promise<SendMessageResult>;
  /** Verifies Meta's `X-Hub-Signature-256` header against the raw webhook body. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
}
