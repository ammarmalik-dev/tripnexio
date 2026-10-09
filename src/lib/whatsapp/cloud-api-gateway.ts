import crypto from "crypto";
import { MAX_MEDIA_BYTES, type DownloadedMedia, type SendInteractiveListInput, type SendMessageResult, type SendTemplateMessageInput, type WhatsAppGateway } from "./gateway";

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

  /**
   * Graph API: GET /{media-id} gives a short-lived URL, which is then fetched
   * with the same token. The URL is only followed when it is https on Meta's
   * own hosts (never an arbitrary address), and files over 8MB are refused.
   */
  async downloadMedia(mediaId: string): Promise<DownloadedMedia | null> {
    if (!/^[\w-]{1,64}$/.test(mediaId)) return null;
    const auth = { Authorization: `Bearer ${this.accessToken}` };
    const meta = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`, { headers: auth });
    if (!meta.ok) return null;
    const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!info.url || (info.file_size ?? 0) > MAX_MEDIA_BYTES) return null;
    let url: URL;
    try {
      url = new URL(info.url);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || !/(^|\.)(fbsbx\.com|facebook\.com|whatsapp\.net)$/.test(url.hostname)) return null;
    const file = await fetch(url, { headers: auth, redirect: "error" });
    if (!file.ok) return null;
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_MEDIA_BYTES) return null;
    return { base64: bytes.toString("base64"), mimeType: (info.mime_type ?? file.headers.get("content-type") ?? "").split(";")[0].trim() };
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
