import type { PaymentGateway } from "./gateway";
import { RazorpayGateway } from "./razorpay-gateway";
import { MockPaymentGateway } from "./mock-gateway";
import { isPlaceholder } from "@/lib/env-placeholder";

/**
 * A dev-only fallback secret for the mock gateway when RAZORPAY_WEBHOOK_SECRET
 * itself is also a placeholder — never used once real Razorpay keys are set,
 * since getPaymentGateway() only reaches the mock branch without them.
 */
const MOCK_WEBHOOK_SECRET_FALLBACK = "mock-dev-only-webhook-secret";

let cached: PaymentGateway | null = null;

/**
 * Selects the real Razorpay integration once RAZORPAY_KEY_ID/KEY_SECRET/
 * WEBHOOK_SECRET are filled in (see .env.example), and falls back to
 * MockPaymentGateway until then — this is the ONLY place that decides which
 * provider is active, per the "swappable service layer" requirement.
 */
export function getPaymentGateway(): PaymentGateway {
  if (cached) return cached;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!isPlaceholder(keyId) && !isPlaceholder(keySecret) && !isPlaceholder(webhookSecret)) {
    cached = new RazorpayGateway(keyId!, keySecret!, webhookSecret!);
  } else {
    cached = new MockPaymentGateway(isPlaceholder(webhookSecret) ? MOCK_WEBHOOK_SECRET_FALLBACK : webhookSecret!);
  }

  return cached;
}
