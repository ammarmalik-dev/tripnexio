import type { AiProvider } from "./ai-provider";
import { LlmAiProvider } from "./llm-ai-provider";
import { KeywordAiProvider } from "./keyword-ai-provider";
import { getTextCompleter } from "@/lib/ai/text-completion";

let cached: AiProvider | null = null;

/**
 * Selects the real Claude-backed AI provider once ANTHROPIC_API_KEY is
 * filled in, falling back to KeywordAiProvider until then — same
 * swappable-service pattern as every other external integration in this
 * app (getPaymentGateway, getEmailSender, getWhatsAppGateway).
 */
export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const model = getTextCompleter();
  cached = model ? new LlmAiProvider(model) : new KeywordAiProvider();
  return cached;
}
