import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

const querySchema = z.object({
  q: z.string().trim().min(2, "Type at least 2 characters").max(100, "Search is too long"),
});

const RESULT_LIMIT = 20;
const SNIPPET_LENGTH = 220;

function snippet(text: string, query: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= SNIPPET_LENGTH) return flat;
  const index = flat.toLowerCase().indexOf(query.toLowerCase());
  const start = index > 60 ? index - 60 : 0;
  const slice = flat.slice(start, start + SNIPPET_LENGTH);
  return `${start > 0 ? "…" : ""}${slice}${start + SNIPPET_LENGTH < flat.length ? "…" : ""}`;
}

/**
 * P22 item 2 — CRM Help page search (CRM.md §27/§28). Searches the internal
 * Knowledge Centre (only when the caller holds `knowledge.view` — the same
 * gate as /api/knowledge-articles, so Help never widens access) and the
 * active + published customer FAQs together. Read-only; any signed-in staff.
 */
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const parsed = querySchema.safeParse({ q: new URL(request.url).searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return jsonError(400, "Invalid search.", parsed.error.flatten().fieldErrors);
  }
  const { q } = parsed.data;
  const canViewKnowledge = hasPermission(session, "knowledge.view");

  try {
    const [articles, faqs] = await Promise.all([
      canViewKnowledge
        ? db.knowledgeArticle.findMany({
            where: {
              active: true,
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
                { keywords: { has: q.toLowerCase() } },
              ],
            },
            orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
            take: RESULT_LIMIT,
          })
        : Promise.resolve([]),
      db.faq.findMany({
        where: {
          active: true,
          published: true,
          OR: [
            { question: { contains: q, mode: "insensitive" } },
            { answer: { contains: q, mode: "insensitive" } },
            { keywords: { has: q.toLowerCase() } },
          ],
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        take: RESULT_LIMIT,
      }),
    ]);

    return jsonSuccess({
      knowledgeSearched: canViewKnowledge,
      knowledge: articles.map((article) => ({
        id: article.id,
        title: article.title,
        category: article.category,
        snippet: snippet(article.content, q),
      })),
      faqs: faqs.map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        serviceType: faq.serviceType,
        category: faq.category,
      })),
    });
  } catch (error) {
    console.error("[help-search] failed", error instanceof Error ? error.message : "unknown");
    return jsonError(500, "Search is unavailable right now. Please try again.");
  }
}
