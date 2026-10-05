import crypto from "crypto";
import type { CreatePaymentLinkInput, CreatePaymentLinkResult, GatewayLinkStatus, GatewayWebhookEvent, PaymentGateway } from "./gateway";

/**
 * Selected automatically by getPaymentGateway() when RAZORPAY_KEY_ID is
 * unset/still a placeholder — lets the whole payment-link -> webhook ->
 * status-transition flow be exercised end-to-end in dev/CI without real
 * Razorpay credentials (which only the client can provide — see
 * CLAUDE.md hard rule #1's spirit: never fabricate what only the client
 * can supply). Uses the exact same HMAC-SHA256 signature scheme as the
 * real gateway, just with a locally-generated secret, so the signature
 * verification code path is genuinely exercised, not bypassed.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly providerName = "mock";

  /** null = no webhook secret configured, so every webhook is rejected. */
  constructor(private readonly webhookSecret: string | null) {}

  async createPaymentLink(_input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    const id = `mock_plink_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    return { gatewayRef: id, paymentLink: `https://mock-gateway.tripnexio.local/pay/${id}` };
  }

  /** The mock keeps no link state: a mock payment completes only through its signed webhook (/api/pay/[token]/mock-pay). */
  async fetchPaymentLinkStatus(_gatewayRef: string): Promise<GatewayLinkStatus> {
    return { paid: false, gatewayPaymentId: null, amountInPaise: null, currency: null };
  }

  verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): GatewayWebhookEvent | null {
    if (!signatureHeader || !this.webhookSecret) return null;
    if (!verifyMockSignature(rawBody, signatureHeader, this.webhookSecret)) return null;

    let payload: { event?: string; gatewayRef?: string; gatewayPaymentId?: string; amountInPaise?: number; currency?: string; eventId?: string };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return null;
    }
    if (!payload.gatewayRef) return null;

    const details = {
      gatewayRef: payload.gatewayRef,
      gatewayPaymentId: payload.gatewayPaymentId ?? null,
      amountInPaise: typeof payload.amountInPaise === "number" ? payload.amountInPaise : null,
      currency: payload.currency ?? null,
      eventId: payload.eventId ?? null,
    };

    if (payload.event === "payment.success") {
      return { type: "PAYMENT_SUCCESS", rawEventName: payload.event, ...details };
    }
    if (payload.event === "payment.failed") {
      return { type: "PAYMENT_FAILED", rawEventName: payload.event, ...details };
    }
    return null;
  }
}

export function signMockWebhookBody(rawBody: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function verifyMockSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = signMockWebhookBody(rawBody, secret);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureHeader, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
