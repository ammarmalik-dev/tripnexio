import { db } from "@/lib/db";
import { getAiProvider } from "@/lib/whatsapp-bot/get-ai-provider";

export interface FaqAnswerResult {
  /** null means "not confidently covered by the FAQ content" — the caller must hand off, never fabricate. */
  answer: string | null;
  providerName: string;
}

/**
 * Step 29 (audit §2.8) — the shared FAQ-answering core, extracted out of
 * the WhatsApp bot's engine (src/lib/whatsapp-bot/engine.ts's
 * answerFaqOrHandoff, which now calls this instead of duplicating it) so
 * the website's Ask AI page (POST /api/ai/ask) can reuse the exact same
 * hallucination-guarded logic — same FAQ knowledge base, same AI
 * provider, same "must NOT invent an answer" guarantee — rather than a
 * second implementation that could drift out of sync. Each caller only
 * adds its own channel-specific formatting/state handling around this.
 */
export async function answerFaqQuestion(question: string): Promise<FaqAnswerResult> {
  const faqs = await db.faq.findMany({ where: { active: true, published: true } });
  const ai = getAiProvider();
  const result = await ai.answerFaq(
    question,
    faqs.map((faq) => ({ question: faq.question, answer: faq.answer, category: faq.category }))
  );
  return { answer: result.answer, providerName: ai.providerName };
}
