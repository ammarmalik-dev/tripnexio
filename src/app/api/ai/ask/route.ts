import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { answerFaqQuestion } from "@/lib/faq/answer-faq";
import { isRateLimited } from "@/lib/auth/rate-limit";

const bodySchema = z.object({ question: z.string().trim().min(1, "Enter a question").max(500, "Question is too long") });

/**
 * Step 29 (audit §2.8) — wires the website's /ai page onto the SAME
 * Claude-powered, hallucination-guarded FAQ engine the WhatsApp bot
 * already has (src/lib/faq/answer-faq.ts — shared, not duplicated), so a
 * website visitor gets a real FAQ-grounded answer instead of the old
 * always-the-same canned reply. `answer: null` is the hallucination
 * guard's own signal ("not confidently covered by the FAQ content") — the
 * frontend must hand off to WhatsApp/staff on that, never invent a reply
 * of its own.
 *
 * Public, unauthenticated (there's no real customer auth session in this
 * app yet — see CLAUDE.md's Auth section), matching the WhatsApp
 * webhook's own public nature for the same underlying engine. Rate-limited
 * per IP, reusing the same in-memory limiter the staff login endpoint
 * uses (CLAUDE.md's "rate-limit auth endpoints" applies just as much to a
 * public, real-Claude-API-backed endpoint like this one).
 *
 * This never claims to check live availability or take a real action —
 * see CLAUDE.md's own "NOT a self-service live-booking engine" constraint
 * — it only ever answers from the stored FAQ content, same as the
 * WhatsApp bot.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(`ask-ai:${ip}`)) {
    return jsonError(429, "Too many questions. Please try again in a few minutes.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const result = await answerFaqQuestion(parsed.data.question);
  return jsonSuccess({ question: parsed.data.question, answer: result.answer });
}
