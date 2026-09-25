import type { DraftProvider } from "./draft-provider";
import { ClaudeDraftProvider } from "./claude-draft-provider";
import { TemplateDraftProvider } from "./template-draft-provider";
import { isPlaceholder } from "@/lib/env-placeholder";

let cached: DraftProvider | null = null;

/** Same swappable-service pattern as getAiProvider/getPaymentGateway/getEmailSender — reuses ANTHROPIC_API_KEY, already wired up for the WhatsApp bot and OCR. */
export function getDraftProvider(): DraftProvider {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = isPlaceholder(apiKey) ? new TemplateDraftProvider() : new ClaudeDraftProvider(apiKey!);
  return cached;
}
