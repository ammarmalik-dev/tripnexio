import type { AiProvider, FaqAnswer, FaqContextEntry } from "./ai-provider";
import type { IntentClassification } from "./intents";
import { BOT_INTENTS } from "./intents";

/**
 * Selected automatically by getAiProvider() when ANTHROPIC_API_KEY is
 * unset/still a placeholder — a genuinely useful fallback, not just a stub:
 * rule-based intent keyword matching (English + common Hinglish phrasing)
 * and FAQ matching against Faq.keywords/question, returning the STORED
 * answer verbatim (never a paraphrase) or null if nothing matches well
 * enough — arguably a stricter "never invent an answer" guarantee than an
 * LLM paraphrase would give, so this isn't a second-class implementation of
 * the FAQ-answering requirement, just a different one.
 */
export class KeywordAiProvider implements AiProvider {
  readonly providerName = "keyword (no ANTHROPIC_API_KEY configured)";

  async classifyIntent(message: string): Promise<IntentClassification> {
    const text = message.toLowerCase().trim();

    if (!text) return { intent: BOT_INTENTS.UNKNOWN, confidence: 0 };

    if (HANDOFF_PHRASES.some((phrase) => text.includes(phrase))) {
      return { intent: BOT_INTENTS.HUMAN_HANDOFF, confidence: 0.6 };
    }

    if (/^(hi|hello|hey|namaste|start|menu)\b/.test(text)) {
      return { intent: BOT_INTENTS.GREETING, confidence: 0.5 };
    }

    // Checked BEFORE service keywords deliberately: a question like "how long
    // does OTB processing take?" contains a service keyword ("otb") but is
    // asking ABOUT the service, not starting a request for it — an
    // interrogative shape should try the FAQ knowledge base first, not
    // silently start a new lead flow the customer never asked for.
    if (text.includes("?") || /^(what|how|when|where|why|can|is|are|does|do|kya|kaise|kab|kaha)\b/.test(text)) {
      return { intent: BOT_INTENTS.FAQ_QUESTION, confidence: 0.4 };
    }

    for (const { phrases, intent } of SERVICE_KEYWORD_RULES) {
      if (phrases.some((phrase) => text.includes(phrase))) {
        return { intent, confidence: 0.6 };
      }
    }

    return { intent: BOT_INTENTS.UNKNOWN, confidence: 0 };
  }

  async answerFaq(question: string, faqs: FaqContextEntry[]): Promise<FaqAnswer> {
    const text = question.toLowerCase();
    const words = text.split(/\W+/).filter((w) => w.length > 2);
    if (words.length === 0 || faqs.length === 0) return { answer: null };

    let best: { faq: FaqContextEntry; score: number } | null = null;
    for (const faq of faqs) {
      const haystack = faq.question.toLowerCase();
      const score = words.filter((word) => haystack.includes(word)).length;
      if (score > 0 && (!best || score > best.score)) {
        best = { faq, score };
      }
    }

    // Require at least 2 overlapping meaningful words (or 1 if the question is short)
    // before trusting the match — a single generic word overlap ("visa") isn't enough
    // to hand back a specific FAQ's answer with confidence.
    const threshold = words.length <= 2 ? 1 : 2;
    if (!best || best.score < threshold) return { answer: null };
    return { answer: best.faq.answer };
  }
}

const HANDOFF_PHRASES = [
  "agent",
  "human",
  "talk to agent",
  "customer care",
  "representative",
  "talk to someone",
  "insaan se baat",
  "agent se baat",
];

const SERVICE_KEYWORD_RULES: { phrases: string[]; intent: IntentClassification["intent"] }[] = [
  {
    intent: BOT_INTENTS.VISA_EXTENSION,
    phrases: ["visa extend", "extend visa", "extend my visa", "visa extension", "visa badhana", "extend karna"],
  },
  {
    intent: BOT_INTENTS.VISA_CHANGE,
    phrases: ["visa change", "change visa", "border exit", "airport to airport", "visa badalna"],
  },
  {
    intent: BOT_INTENTS.OTB,
    phrases: ["otb", "ok to board", "ok-to-board", "boarding permission"],
  },
  {
    intent: BOT_INTENTS.RETURN_TICKET,
    phrases: ["return ticket", "return verified", "verified ticket", "return verify"],
  },
  {
    intent: BOT_INTENTS.FLIGHT_SPECIAL_FARE,
    phrases: ["special fare", "flight ticket", "book flight", "flight book", "cheap flight", "flight fare", "ticket chahiye"],
  },
  {
    intent: BOT_INTENTS.NEW_VISA,
    phrases: ["new visa", "visa chahiye", "tourist visa", "employment visa", "business visa", "apply visa", "visa apply", "visa banana", "visa lagana"],
  },
];
