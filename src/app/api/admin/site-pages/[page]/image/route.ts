import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { checkBase64Upload } from "@/lib/uploads/validate-upload";
import { FILE_URL_PREFIX, deleteUploadedFile, saveUploadedFile } from "@/lib/storage/local-file-storage";
import { SITE_PAGE_DEFS, isSitePage } from "@/lib/site-content/pages";
import { sitePageImageUrl } from "@/lib/site-content/get-page-content";

interface RouteParams {
  params: Promise<{ page: string }>;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const bodySchema = z.object({ data: z.string().min(1) });

/** Client doc 2026-10-15 (J3) — upload (or replace) a website page's hero photo. JPEG/PNG/WebP, 5MB max. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { page } = await params;
  if (!isSitePage(page)) return jsonError(404, "Unknown page.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Choose an image to upload.");
  const check = checkBase64Upload(parsed.data.data, IMAGE_TYPES, MAX_IMAGE_BYTES);
  if (!check.ok) return jsonError(check.status, check.status === 415 ? "Use a JPEG, PNG or WebP image." : check.message);

  try {
    const existing = await db.sitePageContent.findUnique({ where: { page }, select: { heroImageFileId: true } });
    const saved = await saveUploadedFile(parsed.data.data);
    const fileId = saved.url.slice(FILE_URL_PREFIX.length);
    await db.$transaction(async (tx) => {
      await tx.sitePageContent.upsert({
        where: { page },
        create: { page, heroImageFileId: fileId, updatedByUserId: session.id },
        update: { heroImageFileId: fileId, updatedByUserId: session.id },
      });
      await writeAudit(tx, {
        entityType: "SitePageContent",
        entityId: page,
        action: "UPDATE",
        byUserId: session.id,
        note: `Website page "${SITE_PAGE_DEFS[page].label}": photo ${existing?.heroImageFileId ? "replaced" : "added"} (by ${session.name})`,
      });
    });
    if (existing?.heroImageFileId) await deleteUploadedFile(`${FILE_URL_PREFIX}${existing.heroImageFileId}`);
    revalidatePath(SITE_PAGE_DEFS[page].path);
    return jsonSuccess({ heroImageUrl: sitePageImageUrl(fileId) });
  } catch (error) {
    console.error("[api/admin/site-pages/image] upload failed", error);
    return jsonError(500, "Couldn't upload the image. Please try again.");
  }
}

/** Remove the uploaded photo; the page goes back to its built-in one. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { page } = await params;
  if (!isSitePage(page)) return jsonError(404, "Unknown page.");

  try {
    const existing = await db.sitePageContent.findUnique({ where: { page }, select: { heroImageFileId: true } });
    if (!existing?.heroImageFileId) return jsonSuccess({ heroImageUrl: null });
    await db.$transaction(async (tx) => {
      await tx.sitePageContent.update({ where: { page }, data: { heroImageFileId: null, updatedByUserId: session.id } });
      await writeAudit(tx, {
        entityType: "SitePageContent",
        entityId: page,
        action: "UPDATE",
        byUserId: session.id,
        note: `Website page "${SITE_PAGE_DEFS[page].label}": uploaded photo removed, built-in photo restored (by ${session.name})`,
      });
    });
    await deleteUploadedFile(`${FILE_URL_PREFIX}${existing.heroImageFileId}`);
    revalidatePath(SITE_PAGE_DEFS[page].path);
    return jsonSuccess({ heroImageUrl: null });
  } catch (error) {
    console.error("[api/admin/site-pages/image] remove failed", error);
    return jsonError(500, "Couldn't remove the image. Please try again.");
  }
}
