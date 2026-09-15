import type { AdminCommandProvider } from "./command-provider";
import { ClaudeCommandProvider } from "./claude-command-provider";
import { KeywordCommandProvider } from "./keyword-command-provider";
import { isPlaceholder } from "@/lib/env-placeholder";

let cached: AdminCommandProvider | null = null;

/**
 * Selects the real Claude-backed classifier once ANTHROPIC_API_KEY is
 * filled in, falling back to KeywordCommandProvider until then — same
 * swappable-service pattern as every other integration in this app
 * (getPaymentGateway, getEmailSender, getWhatsAppGateway, getAiProvider,
 * getOcrProvider).
 */
export function getCommandProvider(): AdminCommandProvider {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = isPlaceholder(apiKey) ? new KeywordCommandProvider() : new ClaudeCommandProvider(apiKey!);
  return cached;
}
