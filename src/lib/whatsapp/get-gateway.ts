import type { WhatsAppGateway } from "./gateway";
import { WhatsAppCloudApiGateway } from "./cloud-api-gateway";
import { ConsoleWhatsAppGateway } from "./console-gateway";
import { isPlaceholder } from "@/lib/env-placeholder";

let cached: WhatsAppGateway | null = null;

/**
 * Selects the real WhatsApp Cloud API integration once
 * WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID/APP_SECRET are filled in, falling back
 * to ConsoleWhatsAppGateway until then — the ONLY place that decides which
 * provider is active. There is no committed fallback secret: without
 * WHATSAPP_APP_SECRET the console gateway rejects every webhook signature
 * (and in production the webhook route refuses outright).
 */
export function getWhatsAppGateway(): WhatsAppGateway {
  if (cached) return cached;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!isPlaceholder(accessToken) && !isPlaceholder(phoneNumberId) && !isPlaceholder(appSecret)) {
    cached = new WhatsAppCloudApiGateway(accessToken!, phoneNumberId!, appSecret!);
  } else {
    cached = new ConsoleWhatsAppGateway(isPlaceholder(appSecret) ? null : appSecret!);
  }

  return cached;
}
