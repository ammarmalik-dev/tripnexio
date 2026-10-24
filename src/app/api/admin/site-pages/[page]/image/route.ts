import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { checkBase64Upload } from "@/lib/uploads/validate-upload";
import { FILE_URL_PREFIX, deleteUploadedFile, saveUploadedFile } from "@/lib/storage/local-file-storage";
import { Prisma } from "@/generated/prisma/client";
import { SITE_PAGE_DEFS, isSitePage, sectionFields } from "@/lib/site-content/pages";
import { sitePageImageUrl } from "@/lib/site-content/get-page-content";

interface RouteParams {
  params: Promise<{ page: string }>;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** `field` = a section picture ("<section>.<name>", client confirmation 2026-10-25); absent = the hero photo. */
const bodySchema = z.object({ data: z.string().min(1), field: z.string().max(120).optional() });

/** The section picture field, or null for the hero photo; undefined when `field` isn't one of the page's pictures. */
function imageField(page: Parameters<typeof sectionFields>[0], field: string | null | undefined): string | null | undefined {
  if (!field) return null;
  return sectionFields(page).get(field)?.kind === "image" ? field : undefined;
}

function storedFields(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

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

  const field = imageField(page, parsed.data.field);
  if (field === undefined) return jsonError(400, "Unknown picture.");

  try {
    const existing = await db.sitePageContent.findUnique({ where: { page }, select: { heroImageFileId: true, fields: true } });
    const saved = await saveUploadedFile(parsed.data.data);
    const fileId = saved.url.slice(FILE_URL_PREFIX.length);
    if (field) {
      const fields = storedFields(existing?.fields);
      const previous = typeof fields[field] === "string" ? (fields[field] as string) : null;
      fields[field] = fileId;
      await db.$transaction(async (tx) => {
        await tx.sitePageContent.upsert({
          where: { page },
          create: { page, fields: fields as Prisma.InputJsonObject, updatedByUserId: session.id },
          update: { fields: fields as Prisma.InputJsonObject, updatedByUserId: session.id },
        });
        await writeAudit(tx, {
          entityType: "SitePageContent",
          entityId: page,
          action: "UPDATE",
          byUserId: session.id,
          note: `Website page "${SITE_PAGE_DEFS[page].label}": picture "${field}" ${previous ? "replaced" : "added"} (by ${session.name})`,
        });
      });
      if (previous) await deleteUploadedFile(`${FILE_URL_PREFIX}${previous}`);
      revalidatePath(SITE_PAGE_DEFS[page].path);
      return jsonSuccess({ field, imageUrl: sitePageImageUrl(fileId) });
    }
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

/** Remove the uploaded photo (or `?field=` section picture); the page goes back to its built-in one. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { page } = await params;
  if (!isSitePage(page)) return jsonError(404, "Unknown page.");
  const field = imageField(page, request.nextUrl.searchParams.get("field"));
  if (field === undefined) return jsonError(400, "Unknown picture.");

  if (field) {
    try {
      const existing = await db.sitePageContent.findUnique({ where: { page }, select: { fields: true } });
      const fields = storedFields(existing?.fields);
      const previous = typeof fields[field] === "string" ? (fields[field] as string) : null;
      if (!existing || !previous) return jsonSuccess({ field, imageUrl: null });
      delete fields[field];
      await db.$transaction(async (tx) => {
        await tx.sitePageContent.update({ where: { page }, data: { fields: fields as Prisma.InputJsonObject, updatedByUserId: session.id } });
        await writeAudit(tx, {
          entityType: "SitePageContent",
          entityId: page,
          action: "UPDATE",
          byUserId: session.id,
          note: `Website page "${SITE_PAGE_DEFS[page].label}": picture "${field}" removed, built-in picture restored (by ${session.name})`,
        });
      });
      await deleteUploadedFile(`${FILE_URL_PREFIX}${previous}`);
      revalidatePath(SITE_PAGE_DEFS[page].path);
      return jsonSuccess({ field, imageUrl: null });
    } catch (error) {
      console.error("[api/admin/site-pages/image] remove failed", error);
      return jsonError(500, "Couldn't remove the image. Please try again.");
    }
  }

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
