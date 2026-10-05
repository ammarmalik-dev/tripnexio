import crypto from "crypto";
import Razorpay from "razorpay";
import type { CreatePaymentLinkInput, CreatePaymentLinkResult, GatewayLinkStatus, GatewayWebhookEvent, PaymentGateway } from "./gateway";

/**
 * Real Razorpay integration via their Payment Links API (POST
 * /v1/payment_links) — a hosted checkout URL staff can send to a customer
 * (e.g. over WhatsApp), matching this app's staff-mediated model (see
 * CLAUDE.md: "NOT a self-service live-booking engine"). There's no live
 * customer checkout page yet for a client-side Razorpay Checkout.js
 * integration to attach to.
 *
 * Docs: https://razorpay.com/docs/api/payments/payment-links/
 *       https://razorpay.com/docs/webhooks/validate-test/
 */
export class RazorpayGateway implements PaymentGateway {
  readonly providerName = "razorpay";

  private readonly client: Razorpay;
  private readonly webhookSecret: string;

  constructor(keyId: string, keySecret: string, webhookSecret: string) {
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    this.webhookSecret = webhookSecret;
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    const amountInPaise = Math.round(input.amountInRupees * 100);

    const link = await this.client.paymentLink.create({
      amount: amountInPaise,
      currency: "INR",
      description: input.description,
      customer: {
        name: input.customerName,
        contact: input.customerMobile,
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: input.notes,
      expire_by: Math.floor(input.expiresAt.getTime() / 1000),
    });

    return { gatewayRef: link.id, paymentLink: link.short_url };
  }

  async fetchPaymentLinkStatus(gatewayRef: string): Promise<GatewayLinkStatus> {
    // GET /v1/payment_links/:id — status "paid" once the customer has paid in full.
    const link = (await this.client.paymentLink.fetch(gatewayRef)) as unknown as {
      status?: string;
      amount_paid?: number;
      currency?: string;
      payments?: { payment_id?: string }[] | null;
    };
    return {
      paid: link.status === "paid",
      gatewayPaymentId: link.payments?.[0]?.payment_id ?? null,
      amountInPaise: typeof link.amount_paid === "number" ? link.amount_paid : null,
      currency: link.currency ?? null,
    };
  }

  verifyAndParseWebhook(rawBody: string, signatureHeader: string | null): GatewayWebhookEvent | null {
    if (!signatureHeader) return null;
    if (!verifyRazorpaySignature(rawBody, signatureHeader, this.webhookSecret)) return null;

    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return null;
    }

    const linkEntity = payload.payload?.payment_link?.entity;
    const paymentEntity = payload.payload?.payment?.entity;
    const linkId = linkEntity?.id;
    const paymentId = paymentEntity?.id ?? null;
    if (!linkId) return null;

    const rawAmount = paymentEntity?.amount ?? linkEntity?.amount_paid;
    const details = {
      gatewayRef: linkId,
      gatewayPaymentId: paymentId,
      rawEventName: payload.event,
      amountInPaise: typeof rawAmount === "number" ? rawAmount : null,
      currency: paymentEntity?.currency ?? linkEntity?.currency ?? null,
      eventId: null,
    };

    if (payload.event === "payment_link.paid") {
      return { type: "PAYMENT_SUCCESS", ...details };
    }
    if (payload.event === "payment_link.expired" || payload.event === "payment_link.cancelled" || payload.event === "payment.failed") {
      return { type: "PAYMENT_FAILED", ...details };
    }
    return null;
  }
}

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment_link?: { entity?: { id?: string; amount_paid?: number; currency?: string } };
    payment?: { entity?: { id?: string; amount?: number; currency?: string } };
  };
}

/** HMAC-SHA256 hex digest of the raw body using the webhook secret, timing-safe compared to the signature header — Razorpay's documented verification algorithm. Exported standalone so it's independently testable (and reusable by a mock gateway for local testing). */
export function verifyRazorpaySignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureHeader, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
