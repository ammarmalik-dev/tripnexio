import type { WhatsAppGateway } from "./gateway";
import { WhatsAppCloudApiGateway } from "./cloud-api-gateway";
import { ConsoleWhatsAppGateway } from "./console-gateway";
import { isPlaceholder } from "@/lib/env-placeholder";

/**
 * A dev-only fallback secret for the console gateway when WHATSAPP_APP_SECRET
 * itself is also a placeholder — mirrors get-gateway.ts's (Razorpay) pattern.
 */
const MOCK_APP_SECRET_FALLBACK = "whatsapp-dev-only-app-secret";

let cached: WhatsAppGateway | null = null;

/**
 * Selects the real WhatsApp Cloud API integration once
 * WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID are filled in, falling back to
 * ConsoleWhatsAppGateway until then — the ONLY place that decides which
 * provider is active, per the swappable-service-layer pattern used
 * throughout (see get-gateway.ts for Razorpay, get-sender.ts for Resend).
 */
export function getWhatsAppGateway(): WhatsAppGateway {
  if (cached) return cached;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!isPlaceholder(accessToken) && !isPlaceholder(phoneNumberId) && !isPlaceholder(appSecret)) {
    cached = new WhatsAppCloudApiGateway(accessToken!, phoneNumberId!, appSecret!);
  } else {
    cached = new ConsoleWhatsAppGateway(isPlaceholder(appSecret) ? MOCK_APP_SECRET_FALLBACK : appSecret!);
  }

  return cached;
}
