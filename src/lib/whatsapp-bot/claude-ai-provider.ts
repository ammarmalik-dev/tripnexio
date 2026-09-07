import Anthropic from "@anthropic-ai/sdk";
import type { AiProvider, FaqAnswer, FaqContextEntry } from "./ai-provider";
import type { IntentClassification } from "./intents";
import { BOT_INTENTS } from "./intents";

/** Per this project's own instructions to default to the latest, most capable Claude model for AI features. Change here if a newer model should be used. */
const MODEL = "claude-sonnet-5";

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for TripNexio, a travel/visa service for India-to-UAE/GCC customers messaging on WhatsApp. Customers write in English, Hindi, or Hinglish (romanized Hindi mixed with English), e.g. "mera visa extend karna hai" means "I need to extend my visa".

Classify the customer's message into EXACTLY ONE of these intents:
- NEW_VISA — wants a new visa application
- VISA_EXTENSION — wants to extend an existing visa
- VISA_CHANGE — wants to change/switch visa status (airport-to-airport or border exit)
- FLIGHT_SPECIAL_FARE — wants a discounted/special flight fare quote
- RETURN_TICKET — wants a return verified ticket (used for visa applications)
- OTB — wants "OK to Board" airline clearance
- FAQ_QUESTION — is asking a general question, not starting a service request
- HUMAN_HANDOFF — explicitly wants to talk to a human/agent
- GREETING — just saying hi / starting the conversation with no other content
- UNKNOWN — none of the above clearly applies

Respond with ONLY a JSON object, no other text: {"intent": "<ONE_OF_THE_ABOVE>", "confidence": <0 to 1>}`;

const FAQ_SYSTEM_PROMPT = `You are TripNexio's WhatsApp support assistant. Answer the customer's question using ONLY the FAQ content provided below — never use outside knowledge, never guess, never make up an answer, even if it seems obvious.

If the FAQ content clearly answers the question, reply with a short, direct, WhatsApp-appropriate answer (2-4 sentences) based strictly on that content.

If the FAQ content does NOT clearly cover the question, respond with EXACTLY this and nothing else: NOT_FOUND`;

/**
 * Real implementation, selected by getAiProvider() once ANTHROPIC_API_KEY is
 * a real (non-placeholder) value — see get-ai-provider.ts. Both jobs use
 * plain prompted completions (no tool-calling needed for either), with the
 * FAQ prompt's hallucination guard being the load-bearing part of the
 * "must NOT invent an answer" requirement — everything downstream just
 * checks for the literal NOT_FOUND sentinel and hands off if seen.
 */
export class ClaudeAiProvider implements AiProvider {
  readonly providerName = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  private async complete(system: string, userMessage: string, maxTokens: number): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  }

  async classifyIntent(message: string): Promise<IntentClassification> {
    try {
      const raw = await this.complete(INTENT_SYSTEM_PROMPT, message, 100);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { intent: BOT_INTENTS.UNKNOWN, confidence: 0 };
      const parsed = JSON.parse(jsonMatch[0]) as { intent?: string; confidence?: number };
      const validIntents = Object.values(BOT_INTENTS) as string[];
      const intent = parsed.intent && validIntents.includes(parsed.intent) ? (parsed.intent as IntentClassification["intent"]) : BOT_INTENTS.UNKNOWN;
      const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
      return { intent, confidence };
    } catch {
      return { intent: BOT_INTENTS.UNKNOWN, confidence: 0 };
    }
  }

  async answerFaq(question: string, faqs: FaqContextEntry[]): Promise<FaqAnswer> {
    if (faqs.length === 0) return { answer: null };

    const context = faqs.map((faq, index) => `${index + 1}. Q: ${faq.question}\n   A: ${faq.answer}`).join("\n\n");
    const userMessage = `FAQ CONTENT:\n${context}\n\nCUSTOMER QUESTION: ${question}`;

    try {
      const raw = await this.complete(FAQ_SYSTEM_PROMPT, userMessage, 300);
      if (!raw || raw.trim().toUpperCase() === "NOT_FOUND") return { answer: null };
      return { answer: raw };
    } catch {
      return { answer: null };
    }
  }
}
