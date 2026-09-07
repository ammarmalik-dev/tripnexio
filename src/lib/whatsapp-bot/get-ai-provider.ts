import type { AiProvider } from "./ai-provider";
import { ClaudeAiProvider } from "./claude-ai-provider";
import { KeywordAiProvider } from "./keyword-ai-provider";
import { isPlaceholder } from "@/lib/env-placeholder";

let cached: AiProvider | null = null;

/**
 * Selects the real Claude-backed AI provider once ANTHROPIC_API_KEY is
 * filled in, falling back to KeywordAiProvider until then — same
 * swappable-service pattern as every other external integration in this
 * app (getPaymentGateway, getEmailSender, getWhatsAppGateway).
 */
export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = isPlaceholder(apiKey) ? new KeywordAiProvider() : new ClaudeAiProvider(apiKey!);
  return cached;
}
