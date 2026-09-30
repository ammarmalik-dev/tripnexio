import type { PaymentGateway } from "./gateway";
import { RazorpayGateway } from "./razorpay-gateway";
import { MockPaymentGateway } from "./mock-gateway";
import { isPlaceholder } from "@/lib/env-placeholder";

/** Thrown instead of silently falling back to the mock gateway when a production deployment is missing Razorpay configuration. */
export class PaymentGatewayConfigError extends Error {
  constructor() {
    super("Payment gateway is not configured: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET must all be set.");
    this.name = "PaymentGatewayConfigError";
  }
}

let cached: PaymentGateway | null = null;

export function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function isRazorpayConfigured(): boolean {
  return (
    !isPlaceholder(process.env.RAZORPAY_KEY_ID) &&
    !isPlaceholder(process.env.RAZORPAY_KEY_SECRET) &&
    !isPlaceholder(process.env.RAZORPAY_WEBHOOK_SECRET)
  );
}

/** True only outside production while Razorpay isn't configured — never throws, unlike getPaymentGateway(). */
export function isMockGatewayActive(): boolean {
  return !isProductionRuntime() && !isRazorpayConfigured();
}

/**
 * Selects the real Razorpay integration once RAZORPAY_KEY_ID/KEY_SECRET/
 * WEBHOOK_SECRET are filled in (see .env.example). Outside production it
 * falls back to MockPaymentGateway for local development; in production a
 * missing key is a configuration error, never a silent mock. This is the ONLY
 * place that decides which provider is active.
 */
export function getPaymentGateway(): PaymentGateway {
  if (cached) return cached;

  if (isRazorpayConfigured()) {
    cached = new RazorpayGateway(process.env.RAZORPAY_KEY_ID!, process.env.RAZORPAY_KEY_SECRET!, process.env.RAZORPAY_WEBHOOK_SECRET!);
  } else if (isProductionRuntime()) {
    throw new PaymentGatewayConfigError();
  } else {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    // No committed fallback secret: without a configured webhook secret the
    // mock gateway rejects every webhook signature.
    cached = new MockPaymentGateway(isPlaceholder(webhookSecret) ? null : webhookSecret!);
  }

  return cached;
}
