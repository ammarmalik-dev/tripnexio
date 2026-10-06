import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { FILE_URL_PREFIX, readStoredFile } from "@/lib/storage/local-file-storage";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";
import { sniffMimeType } from "@/lib/uploads/validate-upload";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const NOT_FOUND = () => new Response("Not found", { status: 404 });

/**
 * A blog post's uploaded cover. Public only while the post is published
 * (Admin editors can also see a draft's cover); uploads otherwise stay
 * private behind /api/files.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const post = await db.blogPost.findUnique({ where: { id }, select: { status: true, coverFileUrl: true } });
  if (!post?.coverFileUrl?.startsWith(FILE_URL_PREFIX)) return NOT_FOUND();
  const isPublic = post.status === "PUBLISHED";
  if (!isPublic && !hasPermission(await getStaffSession(), "masters.manage")) return NOT_FOUND();

  const stored = await readStoredFile(post.coverFileUrl.slice(FILE_URL_PREFIX.length));
  if (!stored) return NOT_FOUND();
  const mimeType = sniffMimeType(stored.data);
  if (!mimeType?.startsWith("image/")) return NOT_FOUND();

  return new Response(new Uint8Array(stored.data), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
