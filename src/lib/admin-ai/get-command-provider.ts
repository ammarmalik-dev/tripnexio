import type { AdminCommandProvider } from "./command-provider";
import { LlmCommandProvider } from "./llm-command-provider";
import { KeywordCommandProvider } from "./keyword-command-provider";
import { getTextCompleter } from "@/lib/ai/text-completion";

let cached: AdminCommandProvider | null = null;

/**
 * Selects the AI classifier once a text model is configured (Gemini or
 * Claude — src/lib/ai/text-completion.ts), falling back to
 * KeywordCommandProvider until then — same
 * swappable-service pattern as every other integration in this app
 * (getPaymentGateway, getEmailSender, getWhatsAppGateway, getAiProvider,
 * getOcrProvider).
 */
export function getCommandProvider(): AdminCommandProvider {
  if (cached) return cached;

  const model = getTextCompleter();
  cached = model ? new LlmCommandProvider(model) : new KeywordCommandProvider();
  return cached;
}
