import type { EmailSender } from "./sender";
import { ResendEmailSender } from "./resend-sender";
import { ConsoleEmailSender } from "./console-sender";
import { isPlaceholder } from "@/lib/env-placeholder";

const DEFAULT_FROM_ADDRESS = "TripNexio <no-reply@tripnexio.com>";

let cached: EmailSender | null = null;

/**
 * Selects the real Resend integration once RESEND_API_KEY is filled in (see
 * .env.example), and falls back to ConsoleEmailSender until then — this is
 * the ONLY place that decides which provider is active, mirroring
 * getPaymentGateway()'s pattern for the exact same reason (swappable
 * service layer, keys the client hasn't provided yet).
 */
export function getEmailSender(): EmailSender {
  if (cached) return cached;

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = isPlaceholder(process.env.RESEND_FROM_EMAIL) ? DEFAULT_FROM_ADDRESS : process.env.RESEND_FROM_EMAIL!;

  cached = isPlaceholder(apiKey) ? new ConsoleEmailSender() : new ResendEmailSender(apiKey!, fromAddress);
  return cached;
}
