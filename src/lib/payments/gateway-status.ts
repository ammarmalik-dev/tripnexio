import { isPlaceholder } from "../env-placeholder";
import { siteConfig } from "../site-config";
import { isMockGatewayActive, isProductionRuntime, isRazorpayConfigured } from "./get-gateway";

export type GatewayProviderStatus = "razorpay" | "mock" | "unconfigured";
export type GatewayMode = "test" | "live" | "unknown";

export interface PaymentGatewayStatus {
  /** Which provider getPaymentGateway() will use: Razorpay, the dev-only mock, or none (production with missing keys — payments fail loudly). */
  activeProvider: GatewayProviderStatus;
  isProduction: boolean;
  /** Derived from the key id prefix (rzp_test_ / rzp_live_); null when no key id is set. */
  mode: GatewayMode | null;
  keyIdSet: boolean;
  /** First 8 characters + "••••" — never the full key id. null when not set. */
  keyIdMasked: string | null;
  keySecretSet: boolean;
  webhookSecretSet: boolean;
  /** The URL to paste into Razorpay Dashboard → Webhooks. */
  webhookUrl: string;
}

/**
 * P24 — a read-only, secret-free summary of the payment gateway's env
 * configuration for Admin → Payment Gateway. Deliberately never calls
 * getPaymentGateway() (which throws in production when keys are missing)
 * and never returns any secret value, only set / not set.
 */
export function getPaymentGatewayStatus(): PaymentGatewayStatus {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keyIdSet = !isPlaceholder(keyId);
  const trimmedKeyId = keyIdSet ? keyId!.trim() : "";

  let mode: GatewayMode | null = null;
  if (keyIdSet) {
    if (trimmedKeyId.startsWith("rzp_test_")) mode = "test";
    else if (trimmedKeyId.startsWith("rzp_live_")) mode = "live";
    else mode = "unknown";
  }

  const activeProvider: GatewayProviderStatus = isRazorpayConfigured() ? "razorpay" : isMockGatewayActive() ? "mock" : "unconfigured";

  return {
    activeProvider,
    isProduction: isProductionRuntime(),
    mode,
    keyIdSet,
    keyIdMasked: keyIdSet ? `${trimmedKeyId.slice(0, 8)}••••` : null,
    keySecretSet: !isPlaceholder(process.env.RAZORPAY_KEY_SECRET),
    webhookSecretSet: !isPlaceholder(process.env.RAZORPAY_WEBHOOK_SECRET),
    webhookUrl: new URL("/api/webhooks/razorpay", siteConfig.url).toString(),
  };
}
