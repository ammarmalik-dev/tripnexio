import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ publish: z.boolean() });

/** Publish (live on /blog; the first publish sets publishedAt) or unpublish (back to draft). Audited. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid request body.");

  const existing = await db.blogPost.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Post not found.");

  const updated = await db.$transaction(async (tx) => {
    const post = await tx.blogPost.update({
      where: { id },
      data: parsed.data.publish ? { status: "PUBLISHED", publishedAt: existing.publishedAt ?? new Date() } : { status: "DRAFT" },
    });
    await writeAudit(tx, {
      entityType: "BlogPost",
      entityId: id,
      action: parsed.data.publish ? "PUBLISH" : "UNPUBLISH",
      byUserId: session.id,
      note: `Blog post "${post.title}" ${parsed.data.publish ? "published" : "unpublished"} (by ${session.name})`,
    });
    return post;
  });
  revalidatePath("/blog");
  revalidatePath(`/blog/${updated.slug}`);
  return jsonSuccess(updated);
}
