import crypto from "crypto";
import type { CreatePaymentLinkInput, CreatePaymentLinkResult, GatewayHealth, GatewayLinkStatus, GatewayWebhookEvent, PaymentGateway } from "./gateway";

const API_VERSION = "2023-08-01";

/**
 * Client corrections 2026-10-05 §27 — Cashfree as a failover gateway, via its
 * Payment Links API (the same hosted-link model as Razorpay, so the rest of
 * the payment flow is unchanged).
 *
 * Docs: https://docs.cashfree.com/reference/pgcreatelink (POST /pg/links),
 *       https://docs.cashfree.com/reference/pgfetchlink (GET /pg/links/{link_id}),
 *       webhook signature = base64(HMAC-SHA256(secret, timestamp + rawBody)).
 *
 * Not exercised against a live Cashfree account yet (no credentials from the
 * client); an account using it stays "Not configured" until its env vars are
 * set, and the Admin health check proves the keys before it is used.
 */
export class CashfreeGateway implements PaymentGateway {
  readonly providerName = "cashfree";

  private readonly baseUrl: string;

  constructor(
    private readonly appId: string,
    private readonly secretKey: string,
    environment: "production" | "sandbox"
  ) {
    this.baseUrl = environment === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
  }

  private headers(): Record<string, string> {
    return {
      "x-client-id": this.appId,
      "x-client-secret": this.secretKey,
      "x-api-version": API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    // Our own link id (Cashfree requires one, max 50 chars, alphanumeric/_/-).
    const linkId = `tnx_${Date.now().toString(36)}_${crypto.randomBytes(5).toString("hex")}`;
    const phone = input.customerMobile.replace(/[^\d]/g, "").slice(-10);
    const response = await fetch(`${this.baseUrl}/pg/links`, {
      method: "POST",
      headers: this.headers(),
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        link_id: linkId,
        link_amount: Math.round(input.amountInRupees * 100) / 100,
        link_currency: "INR",
        link_purpose: input.description.slice(0, 500),
        customer_details: {
          customer_name: input.customerName,
          customer_phone: phone,
          ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
        },
        link_expiry_time: input.expiresAt.toISOString(),
        link_notes: input.notes,
        link_notify: { send_sms: false, send_email: false },
        ...(input.callbackUrl ? { link_meta: { return_url: input.callbackUrl } } : {}),
      }),
    });
    const body = (await response.json().catch(() => null)) as { link_url?: string; link_id?: string; message?: string } | null;
    if (!response.ok || !body?.link_url) {
      throw new Error(`Cashfree create link failed (HTTP ${response.status}${body?.message ? `: ${body.message}` : ""})`);
    }
    return { gatewayRef: body.link_id ?? linkId, paymentLink: body.link_url };
  }

  async fetchPaymentLinkStatus(gatewayRef: string): Promise<GatewayLinkStatus> {
    const response = await fetch(`${this.baseUrl}/pg/links/${encodeURIComponent(gatewayRef)}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Cashfree fetch link failed (HTTP ${response.status})`);
    const link = (await response.json()) as { link_status?: string; link_amount_paid?: number; link_currency?: string };
    return {
      paid: link.link_status === "PAID",
      gatewayPaymentId: null,
      amountInPaise: typeof link.link_amount_paid === "number" ? Math.round(link.link_amount_paid * 100) : null,
      currency: link.link_currency ?? null,
    };
  }

  /**
   * Cashfree signs `timestamp + rawBody`; the signature header carries both,
   * joined as "<timestamp>.<signature>" by the webhook route (see
   * /api/webhooks/cashfree) so this keeps the shared one-header interface.
   */
  verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): GatewayWebhookEvent | null {
    if (!signatureHeader) return null;
    const dot = signatureHeader.indexOf(".");
    if (dot <= 0) return null;
    const timestamp = signatureHeader.slice(0, dot);
    const signature = signatureHeader.slice(dot + 1);
    if (!verifyCashfreeSignature(rawBody, timestamp, signature, this.secretKey)) return null;

    let payload: CashfreeWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const data = payload.data;
    const linkId = data?.link_id;
    if (!linkId) return null;
    const details = {
      gatewayRef: linkId,
      gatewayPaymentId: data?.order?.transaction_id != null ? String(data.order.transaction_id) : null,
      rawEventName: `${payload.type ?? "event"}:${data?.link_status ?? "unknown"}`,
      amountInPaise: typeof data?.link_amount_paid === "number" ? Math.round(data.link_amount_paid * 100) : null,
      currency: data?.link_currency ?? null,
      eventId: null,
    };
    if (data?.link_status === "PAID") return { type: "PAYMENT_SUCCESS", ...details };
    if (data?.link_status === "EXPIRED" || data?.link_status === "CANCELLED") return { type: "PAYMENT_FAILED", ...details };
    return null;
  }

  /** GET of a link id that can't exist: 404 = credentials accepted, 401/403 = rejected. */
  async healthCheck(): Promise<GatewayHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/pg/links/tnx_healthcheck_probe`, { headers: this.headers(), signal: AbortSignal.timeout(10_000) });
      if (response.status === 401 || response.status === 403) return { ok: false, message: `Cashfree rejected the credentials (${response.status}).` };
      if (response.ok || response.status === 404) return { ok: true, message: "Cashfree API reachable, credentials accepted." };
      return { ok: false, message: `Cashfree returned HTTP ${response.status}.` };
    } catch (error) {
      return { ok: false, message: `Cashfree unreachable: ${error instanceof Error ? error.name : "error"}.` };
    }
  }
}

interface CashfreeWebhookPayload {
  type?: string;
  data?: {
    link_id?: string;
    link_status?: string;
    link_amount_paid?: number;
    link_currency?: string;
    order?: { transaction_id?: string | number };
  };
}

/** base64(HMAC-SHA256(secret, timestamp + rawBody)), compared in constant time. */
export function verifyCashfreeSignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
