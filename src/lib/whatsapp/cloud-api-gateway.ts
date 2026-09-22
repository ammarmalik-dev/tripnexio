import crypto from "crypto";
import type { SendInteractiveListInput, SendMessageResult, SendTemplateMessageInput, WhatsAppGateway } from "./gateway";

const GRAPH_API_VERSION = "v21.0";

interface CloudApiSendResponse {
  messages?: { id: string }[];
  error?: { message: string; type?: string; code?: number };
}

/**
 * Real WhatsApp Cloud API integration — POST to
 * https://graph.facebook.com/{version}/{phoneNumberId}/messages using the
 * permanent access token as a Bearer credential. No official Node SDK exists
 * (unlike Razorpay/Resend), so this calls the well-documented REST API
 * directly via fetch rather than pulling in a third-party wrapper.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 *       https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validating-payloads
 */
export class WhatsAppCloudApiGateway implements WhatsAppGateway {
  readonly providerName = "whatsapp-cloud-api";

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
    private readonly appSecret: string
  ) {}

  private async send(payload: Record<string, unknown>): Promise<SendMessageResult> {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const data = (await res.json()) as CloudApiSendResponse;
    if (!res.ok || data.error) {
      throw new Error(`WhatsApp Cloud API send failed (${res.status}): ${data.error?.message ?? "unknown error"}`);
    }
    return { id: data.messages?.[0]?.id ?? null };
  }

  async sendSessionText(to: string, body: string): Promise<SendMessageResult> {
    return this.send({ to, type: "text", text: { body, preview_url: false } });
  }

  async sendInteractiveList(to: string, input: SendInteractiveListInput): Promise<SendMessageResult> {
    return this.send({
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: input.bodyText },
        ...(input.footerText ? { footer: { text: input.footerText } } : {}),
        action: {
          button: input.buttonText,
          sections: input.sections.map((section) => ({
            ...(section.title ? { title: section.title } : {}),
            rows: section.rows.map((row) => ({ id: row.id, title: row.title, ...(row.description ? { description: row.description } : {}) })),
          })),
        },
      },
    });
  }

  async sendTemplateMessage(to: string, input: SendTemplateMessageInput): Promise<SendMessageResult> {
    return this.send({
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: input.bodyParameters.length
          ? [{ type: "body", parameters: input.bodyParameters.map((text) => ({ type: "text", text })) }]
          : undefined,
      },
    });
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    return verifyMetaSignature(rawBody, signatureHeader, this.appSecret);
  }
}

/** Meta's documented scheme: `X-Hub-Signature-256: sha256=<hex hmac of the raw body using the App Secret>`, timing-safe compared. Exported standalone so a mock gateway can reuse the exact algorithm with a different secret. */
export function verifyMetaSignature(rawBody: string, signatureHeader: string, appSecret: string): boolean {
  const prefix = "sha256=";
  if (!signatureHeader.startsWith(prefix)) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureHeader.slice(prefix.length), "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
