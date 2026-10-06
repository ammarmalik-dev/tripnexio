import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { deleteUploadedFile } from "@/lib/storage/local-file-storage";
import { updateBlogPostSchema } from "@/lib/blog/blog";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { id } = await params;
  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) return jsonError(404, "Post not found.");
  return jsonSuccess(post);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
  const parsed = updateBlogPostSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const existing = await db.blogPost.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Post not found.");
  if (
    parsed.data.slug &&
    parsed.data.slug !== existing.slug &&
    (await db.blogPost.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } }))
  ) {
    return jsonError(400, "That URL slug is already used by another post.", { slug: ["Already used — pick another."] });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      const post = await tx.blogPost.update({
        where: { id },
        data: { ...parsed.data, ...(parsed.data.coverImageUrl !== undefined ? { coverImageUrl: parsed.data.coverImageUrl || null } : {}) },
      });
      await writeAudit(tx, {
        entityType: "BlogPost",
        entityId: id,
        action: "UPDATE",
        byUserId: session.id,
        note: `Blog post "${post.title}" edited (by ${session.name})`,
      });
      return post;
    });
    revalidatePath("/blog");
    revalidatePath(`/blog/${existing.slug}`);
    if (updated.slug !== existing.slug) revalidatePath(`/blog/${updated.slug}`);
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[api/admin/blog] update failed", error);
    return jsonError(500, "Couldn't save the post. Please try again.");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  const reasonResult = await readDeleteReason(request);
  if (reasonResult.error) return reasonResult.error;

  const existing = await db.blogPost.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Post not found.");

  await db.$transaction(async (tx) => {
    await tx.blogPost.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "BlogPost",
      entityId: id,
      action: "DELETE",
      byUserId: session.id,
      note: withReason(`Blog post "${existing.title}" deleted (by ${session.name})`, reasonResult.reason),
    });
  });
  if (existing.coverFileUrl) await deleteUploadedFile(existing.coverFileUrl).catch(() => undefined);
  revalidatePath("/blog");
  revalidatePath(`/blog/${existing.slug}`);
  return jsonSuccess({ id });
}
