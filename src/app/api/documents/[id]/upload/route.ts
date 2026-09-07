import type { NextRequest } from "next/server";
import { uploadDocumentSchema } from "@/lib/validation/document-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { runPassportExtraction } from "@/lib/ocr/extract-passport";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Accepts an upload URL for an already-hosted file — no file storage is
 * integrated here, this just attaches the URL. Staff-gated for now since
 * there's no customer-facing session system yet (see CLAUDE.md Auth
 * section) — this becomes the customer's own upload endpoint once that
 * exists, gated differently at that point.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("documents.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = uploadDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.document.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Document not found.");

  const nextStatus = existing.status === "REQUIRED" || existing.status === "MISSING" ? "RECEIVED" : existing.status;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.document.update({
      where: { id },
      data: { fileUrl: parsed.data.fileUrl, status: nextStatus },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: id,
      action: "UPLOAD",
      byUserId: session.id,
      note: `File URL attached; status ${existing.status} -> ${nextStatus} (by ${session.name})`,
    });
    return result;
  });

  // Passport-type documents with a passenger to attach to get OCR run
  // automatically on upload — never blocks the upload response itself if
  // OCR fails (e.g. an unsupported image, a provider hiccup); the upload
  // has already succeeded by this point regardless.
  if (/passport/i.test(updated.type) && updated.passengerId) {
    try {
      await runPassportExtraction(updated.id);
    } catch (error) {
      console.error("[documents/upload] passport OCR failed", error);
    }
  }

  return jsonSuccess(updated);
}
