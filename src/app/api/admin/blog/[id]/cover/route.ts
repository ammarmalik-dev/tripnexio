import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { checkBase64Upload } from "@/lib/uploads/validate-upload";
import { deleteUploadedFile, saveUploadedFile, UploadValidationError } from "@/lib/storage/local-file-storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ imageBase64: z.string().min(1).nullable() });
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Uploads (or with null removes) a post's own cover image. Validated as JPEG/PNG/WebP, max 8MB, stored privately. */
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

  let coverFileUrl: string | null = null;
  if (parsed.data.imageBase64) {
    const check = checkBase64Upload(parsed.data.imageBase64, COVER_TYPES);
    if (!check.ok) return jsonError(check.status, check.message);
    try {
      coverFileUrl = (await saveUploadedFile(parsed.data.imageBase64)).url;
    } catch (error) {
      if (error instanceof UploadValidationError) return jsonError(error.status, error.message);
      console.error("[api/admin/blog/cover] save failed", error);
      return jsonError(500, "Couldn't save the image. Please try again.");
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const post = await tx.blogPost.update({ where: { id }, data: { coverFileUrl } });
    await writeAudit(tx, {
      entityType: "BlogPost",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Blog post "${post.title}" cover ${coverFileUrl ? "uploaded" : "removed"} (by ${session.name})`,
    });
    return post;
  });
  if (existing.coverFileUrl) await deleteUploadedFile(existing.coverFileUrl).catch(() => undefined);
  revalidatePath("/blog");
  revalidatePath(`/blog/${updated.slug}`);
  return jsonSuccess(updated);
}
