import type { CommandTypeKey } from "./command-types";

export interface CommandClassification {
  commandType: CommandTypeKey;
  /** Extracted parameter value for the matched type's `requiresParam`, if any — e.g. a booking reference, a customer name. */
  param: string | null;
  confidence: number;
}

/**
 * Step 27 (audit §4.4) — the "Understand" stage of ADMIN.md §10's
 * execution model, matching the exact swappable-provider shape already
 * established for the WhatsApp bot's AI layer (src/lib/whatsapp-bot/ai-provider.ts):
 * a real Claude implementation plus a keyword-based fallback, selected the
 * same way every other integration in this app is (getPaymentGateway,
 * getEmailSender, getAiProvider). This interface is deliberately narrow —
 * classify text into one of a closed set of query types plus a single
 * extracted parameter — it has no execution authority of its own; see
 * src/lib/admin-ai/handlers.ts for the actual (distinct, hand-written)
 * execution layer this classification feeds into.
 */
export interface AdminCommandProvider {
  readonly providerName: string;
  classifyCommand(question: string): Promise<CommandClassification>;
}
