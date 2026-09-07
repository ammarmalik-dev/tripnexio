import type { OcrProvider } from "./provider";
import { ClaudeOcrProvider } from "./claude-ocr-provider";
import { PlaceholderOcrProvider } from "./placeholder-provider";
import { isPlaceholder } from "@/lib/env-placeholder";

let cached: OcrProvider | null = null;

/**
 * Selects the real Claude-vision OCR provider once ANTHROPIC_API_KEY is
 * filled in, falling back to PlaceholderOcrProvider until then — same
 * swappable-service pattern as every other integration this project uses
 * (getPaymentGateway, getEmailSender, getWhatsAppGateway, getAiProvider).
 * Deliberately reuses ANTHROPIC_API_KEY rather than a separate
 * "OCR_PROVIDER_API_KEY" — it's the same vendor/credential already wired up
 * for the WhatsApp bot (Phase 5C), not a second account the client would
 * need to create. The OcrProvider interface stays fully swappable for a
 * dedicated document-OCR vendor later if that ever becomes worth it.
 */
export function getOcrProvider(): OcrProvider {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = isPlaceholder(apiKey) ? new PlaceholderOcrProvider() : new ClaudeOcrProvider(apiKey!);
  return cached;
}
