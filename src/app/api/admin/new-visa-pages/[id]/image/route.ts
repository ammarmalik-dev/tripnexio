import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { countryPageImageSchema } from "@/lib/new-visa/country-page-schema";
import { checkBase64Upload } from "@/lib/uploads/validate-upload";
import { FILE_URL_PREFIX, deleteUploadedFile, saveUploadedFile } from "@/lib/storage/local-file-storage";
import { countryPageImageUrl } from "@/lib/new-visa/country-pages";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fieldFor(kind: "card" | "hero") {
  return kind === "card" ? "cardImageFileId" : "heroImageFileId";
}

/** Upload (or replace) the page's card or hero image. JPEG/PNG/WebP, 5MB max. */
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
  const parsed = countryPageImageSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Choose an image to upload.");
  const { kind, data } = parsed.data;

  const check = checkBase64Upload(data, IMAGE_TYPES, MAX_IMAGE_BYTES);
  if (!check.ok) {
    return jsonError(check.status, check.status === 415 ? "Use a JPEG, PNG or WebP image." : check.message);
  }

  try {
    const page = await db.newVisaCountryPage.findUnique({ where: { id }, include: { country: { select: { name: true } } } });
    if (!page) return jsonError(404, "Page not found.");

    const saved = await saveUploadedFile(data);
    const fileId = saved.url.slice(FILE_URL_PREFIX.length);
    const field = fieldFor(kind);
    const previous = page[field];

    await db.$transaction(async (tx) => {
      await tx.newVisaCountryPage.update({ where: { id }, data: { [field]: fileId } });
      await writeAudit(tx, {
        entityType: "NewVisaCountryPage",
        entityId: id,
        action: "UPDATE",
        byUserId: session.id,
        note: `New Visa page for ${page.country.name}: ${kind} image ${previous ? "replaced" : "added"} (by ${session.name})`,
      });
    });
    if (previous) await deleteUploadedFile(`${FILE_URL_PREFIX}${previous}`);

    return jsonSuccess({ kind, fileId, url: countryPageImageUrl(fileId) });
  } catch (error) {
    console.error("[api/admin/new-visa-pages/image] upload failed", error);
    return jsonError(500, "Couldn't upload the image. Please try again.");
  }
}

/** Remove the card or hero image (?kind=card|hero); the page falls back to the default photo. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "card" && kind !== "hero") return jsonError(400, "Unknown image.");

  try {
    const page = await db.newVisaCountryPage.findUnique({ where: { id }, include: { country: { select: { name: true } } } });
    if (!page) return jsonError(404, "Page not found.");
    const field = fieldFor(kind);
    const previous = page[field];
    if (!previous) return jsonSuccess({ kind, fileId: null, url: null });

    await db.$transaction(async (tx) => {
      await tx.newVisaCountryPage.update({ where: { id }, data: { [field]: null } });
      await writeAudit(tx, {
        entityType: "NewVisaCountryPage",
        entityId: id,
        action: "UPDATE",
        byUserId: session.id,
        note: `New Visa page for ${page.country.name}: ${kind} image removed (by ${session.name})`,
      });
    });
    await deleteUploadedFile(`${FILE_URL_PREFIX}${previous}`);
    return jsonSuccess({ kind, fileId: null, url: null });
  } catch (error) {
    console.error("[api/admin/new-visa-pages/image] delete failed", error);
    return jsonError(500, "Couldn't remove the image. Please try again.");
  }
}
