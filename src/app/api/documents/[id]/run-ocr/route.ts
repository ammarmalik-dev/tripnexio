import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { runPassportExtraction } from "@/lib/ocr/extract-passport";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Manual re-run — the upload route already triggers OCR automatically for
 * passport-type documents, but staff need a way to retry (a blurry first
 * photo, a provider hiccup, or a document that didn't get its type set to
 * something passport-like until after upload).
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const auth = await requirePermission("documents.edit");
  if (auth.error) return auth.error;

  const { id } = await params;

  const document = await db.document.findUnique({ where: { id }, include: { booking: { include: { lead: true } } } });
  if (!document) return jsonError(404, "Document not found.");
  if (!document.fileUrl) return jsonError(409, "This document has no file attached yet.");
  if (!document.passengerId) return jsonError(409, "This document isn't attached to a passenger.");
  if (document.booking) {
    const scopeError = assertServiceAccess(auth.session, document.booking.lead.serviceType);
    if (scopeError) return scopeError;
  }

  try {
    const extraction = await runPassportExtraction(id);
    return jsonSuccess(extraction, 201);
  } catch (error) {
    console.error("[documents/run-ocr]", error);
    return jsonError(500, "Couldn't run OCR on this document. Please try again.");
  }
}
