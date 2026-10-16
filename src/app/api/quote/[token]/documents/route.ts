import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { deleteUploadedFile, saveUploadedFile } from "@/lib/storage/local-file-storage";
import { rejectInvalidDocumentUploads } from "@/lib/uploads/validate-upload";
import { describeError } from "@/lib/api/describe-error";
import { notifyDocumentUploaded } from "@/lib/staff-notifications/triggers";
import { rateLimitByIp } from "@/lib/auth/rate-limit";
import { LEAD_UPLOAD_SERVICES, LEAD_UPLOAD_TYPES } from "@/lib/quotations/lead-document-upload";
import { runOcrForDocument } from "@/lib/ocr/run-for-document";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** ~3MB file (client doc 2026-10-15: PDF / PNG / JPG under 3MB). */
const MAX_BASE64_LENGTH = 4_000_000;

const uploadSchema = z.object({
  passengerId: z.string().min(1),
  type: z.enum(LEAD_UPLOAD_TYPES.map((entry) => entry.type) as ["PASSPORT", "VISA_COPY"]),
  fileBase64: z.string().min(1, "Choose a file").max(MAX_BASE64_LENGTH, "That file is too large (3MB max)"),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"], { error: "Upload a PDF, PNG or JPG" }),
});

/**
 * Client doc 2026-10-15 — Visa Extension / Visa Change: after the request, the
 * customer uploads each passenger's passport and visa copy from their quote
 * link (token-gated) so staff can validate them before quoting. Only this
 * lead's own passengers; uploading a type again replaces the earlier file.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return jsonError(404, "We couldn't find that request.");
  const limited = await rateLimitByIp(request, "quote-upload", { limit: 30, windowMs: 60 * 60 * 1000 }, "Too many uploads — please try again later.");
  if (limited) return limited;

  const lead = await db.lead.findUnique({ where: { customerToken: token }, select: { id: true, serviceType: true, details: true } });
  if (!lead || !LEAD_UPLOAD_SERVICES.has(lead.serviceType)) return jsonError(404, "We couldn't find that request.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the file and try again.", parsed.error.flatten().fieldErrors);
  const uploadError = rejectInvalidDocumentUploads([parsed.data.fileBase64]);
  if (uploadError) return uploadError;
  const { passengerId, type, fileBase64 } = parsed.data;

  const details = (lead.details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(details.passengerIds) ? details.passengerIds : [];
  if (!passengerIds.includes(passengerId)) return jsonError(400, "That passenger isn't part of this request.");

  try {
    const { url } = await saveUploadedFile(fileBase64);
    const existing = await db.document.findFirst({ where: { passengerId, type, leadId: lead.id, bookingId: null, purgedAt: null }, orderBy: { updatedAt: "desc" } });
    const document = await db.$transaction(async (tx) => {
      const saved = existing
        ? await tx.document.update({ where: { id: existing.id }, data: { fileUrl: url, status: "RECEIVED", rejectionReason: null } })
        : await tx.document.create({ data: { passengerId, leadId: lead.id, type, status: "RECEIVED", fileUrl: url } });
      await writeAudit(tx, {
        entityType: "Document",
        entityId: saved.id,
        action: existing ? "REPLACE_UPLOAD" : "CREATE",
        note: `${type} uploaded by the customer from the quote link (lead ${lead.id})`,
      });
      return saved;
    });
    await notifyDocumentUploaded(document.id);
    if (existing?.fileUrl) await deleteUploadedFile(existing.fileUrl);
    // Client doc 2026-10-15 (J4) — OCR + check against the entered details, in the background (never delays the upload).
    void runOcrForDocument(document.id);
    return jsonSuccess({ id: document.id, passengerId, type, status: document.status }, 201);
  } catch (error) {
    console.error("[api/quote/documents]", describeError(error));
    return jsonError(500, "We couldn't save that file. Please try again.");
  }
}
