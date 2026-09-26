import type { NextRequest } from "next/server";
import { createKnowledgeArticleSchema } from "@/lib/validation/knowledge-article-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/** Item 14 (client-message/PENDING_WORK_PROMPTS.md) — the CRM's internal Knowledge Centre (SOPs, staff FAQ, training material). */
export async function GET() {
  const auth = await requirePermission("knowledge.view");
  if (auth.error) return auth.error;

  const articles = await db.knowledgeArticle.findMany({ orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }] });
  return jsonSuccess(articles);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("knowledge.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createKnowledgeArticleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const article = await db.$transaction(async (tx) => {
    const created = await tx.knowledgeArticle.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "KnowledgeArticle",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Knowledge Centre article "${created.title}" created (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(article, 201);
}
