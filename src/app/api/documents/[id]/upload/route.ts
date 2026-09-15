import type { NextRequest } from "next/server";
import { uploadDocumentSchema } from "@/lib/validation/document-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage/local-file-storage";
import { runPassportExtraction } from "@/lib/ocr/extract-passport";
import { runTicketExtraction } from "@/lib/ocr/extract-ticket";
import { runVisaExtraction } from "@/lib/ocr/extract-visa";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Accepts either an upload URL for an already-hosted file (the original
 * behavior), or real file bytes to save directly (Step 16, audit §3.6 —
 * added so Ticket/Visa documents can be genuinely uploaded, not just
 * URL-pasted). Staff-gated for now since there's no customer-facing
 * session system yet (see CLAUDE.md Auth section) — this becomes the
 * customer's own upload endpoint once that exists, gated differently at
 * that point.
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

  let fileUrl: string;
  if ("fileUrl" in parsed.data) {
    fileUrl = parsed.data.fileUrl;
  } else {
    try {
      const saved = await saveUploadedFile(parsed.data.fileBase64, parsed.data.mimeType, "documents");
      fileUrl = saved.url;
    } catch (error) {
      console.error("[documents/upload] file save failed", error);
      return jsonError(400, "Couldn't save that file. Please try a JPEG, PNG, GIF, WebP, or PDF.");
    }
  }

  const nextStatus = existing.status === "REQUIRED" || existing.status === "MISSING" ? "RECEIVED" : existing.status;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.document.update({
      where: { id },
      data: { fileUrl, status: nextStatus },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: id,
      action: "UPLOAD",
      byUserId: session.id,
      note: `File attached; status ${existing.status} -> ${nextStatus} (by ${session.name})`,
    });
    return result;
  });

  // New_Visa.md §18: "old file is deleted, new becomes active." Only for a
  // genuine replacement (a real prior local file, different from the new
  // one) — best-effort, after the DB commit so a slow/failed disk delete
  // never blocks the response the staff member is waiting on.
  if (existing.fileUrl && existing.fileUrl !== fileUrl) {
    void deleteUploadedFile(existing.fileUrl);
  }

  // OCR runs automatically based on the document's own `type`, matching
  // whichever extraction pipeline applies — never blocks the upload
  // response itself if OCR fails (e.g. an unsupported file, a provider
  // hiccup); the upload has already succeeded by this point regardless.
  // Step 16 (audit §3.6) generalized this from passport-only to also cover
  // Ticket (CRM.md §17) and Visa (CRM.md §18) documents.
  try {
    if (/passport/i.test(updated.type) && updated.passengerId) {
      await runPassportExtraction(updated.id);
    } else if (/ticket/i.test(updated.type)) {
      await runTicketExtraction(updated.id);
    } else if (/visa/i.test(updated.type)) {
      await runVisaExtraction(updated.id);
    }
  } catch (error) {
    console.error("[documents/upload] OCR failed", error);
  }

  return jsonSuccess(updated);
}
