import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { blogPostSchema } from "@/lib/blog/blog";

/** Client request 2026-10-06 — Admin → Blog: every post, most recently edited first (drafts included). */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const posts = await db.blogPost.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, slug: true, title: true, category: true, status: true, publishedAt: true, updatedAt: true, authorName: true },
  });
  return jsonSuccess(posts);
}

/** Creates a post as a DRAFT; publishing is its own action (POST /api/admin/blog/[id]/publish). */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = blogPostSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  if (await db.blogPost.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } })) {
    return jsonError(400, "That URL slug is already used by another post.", { slug: ["Already used — pick another."] });
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const post = await tx.blogPost.create({
        data: { ...parsed.data, coverImageUrl: parsed.data.coverImageUrl || null, status: "DRAFT", createdByUserId: session.id },
      });
      await writeAudit(tx, {
        entityType: "BlogPost",
        entityId: post.id,
        action: "CREATE",
        byUserId: session.id,
        note: `Blog post "${post.title}" created as a draft (by ${session.name})`,
      });
      return post;
    });
    return jsonSuccess(created, 201);
  } catch (error) {
    console.error("[api/admin/blog] create failed", error);
    return jsonError(500, "Couldn't save the post. Please try again.");
  }
}
