import type { IntentClassification } from "./intents";

export interface FaqContextEntry {
  question: string;
  answer: string;
  category: string | null;
}

export interface FaqAnswer {
  /** null means "not confidently covered by the FAQ content" — the caller must hand off, never fabricate. */
  answer: string | null;
}

/**
 * Swappable AI layer for the two genuinely "AI" jobs the bot journey needs:
 * free-text intent classification (handles phrasing like "mera visa extend
 * karna hai", not just exact keywords) and FAQ answering CONSTRAINED to the
 * Admin FAQ knowledge base only. See ClaudeAiProvider (real) and
 * KeywordAiProvider (mock/fallback) — selected by getAiProvider() the same
 * way every other external-service factory in this app works.
 */
export interface AiProvider {
  readonly providerName: string;
  classifyIntent(message: string): Promise<IntentClassification>;
  answerFaq(question: string, faqs: FaqContextEntry[]): Promise<FaqAnswer>;
}
