import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { loadCheckoutByToken } from "@/lib/checkout/load-checkout";
import { getCheckoutDocumentTypes } from "@/lib/checkout/required-documents";
import { deleteUploadedFile, saveUploadedFile } from "@/lib/storage/local-file-storage";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** Keeps the JSON body under typical serverless request limits (~4.5MB). */
const MAX_BASE64_LENGTH = 4_000_000;

const uploadSchema = z.object({
  passengerId: z.string().min(1),
  type: z.string().min(1),
  fileBase64: z.string().min(1, "Choose a file").max(MAX_BASE64_LENGTH, "That file is too large (3MB max)"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]),
});

/**
 * Post-payment document upload for the guest customer (token-gated). Only
 * available once the payment succeeded; only the service's required document
 * types, and only for this booking's own applicants. Uploading the same
 * type again for an applicant replaces the earlier file.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const checkout = await loadCheckoutByToken(token);
  if (!checkout) return jsonError(404, "We couldn't find that payment page.");
  if (checkout.view.payment?.status !== "SUCCESS") {
    return jsonError(409, "Please complete your payment before uploading documents.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the file and try again.", parsed.error.flatten().fieldErrors);
  }
  const { passengerId, type, fileBase64, mimeType } = parsed.data;

  if (!checkout.view.applicants.some((applicant) => applicant.id === passengerId)) {
    return jsonError(400, "That applicant isn't part of this booking.");
  }
  if (!getCheckoutDocumentTypes(checkout.booking.lead.serviceType).some((doc) => doc.type === type)) {
    return jsonError(400, "That document isn't needed for this service.");
  }

  try {
    const { url } = await saveUploadedFile(fileBase64, mimeType, "documents");
    const bookingId = checkout.booking.id;
    const existing = await db.document.findFirst({ where: { bookingId, passengerId, type } });

    const document = await db.$transaction(async (tx) => {
      const saved = existing
        ? await tx.document.update({ where: { id: existing.id }, data: { fileUrl: url, status: "RECEIVED", purgedAt: null } })
        : await tx.document.create({ data: { bookingId, passengerId, type, status: "RECEIVED", fileUrl: url } });
      await writeAudit(tx, {
        entityType: "Document",
        entityId: saved.id,
        action: existing ? "REPLACE_UPLOAD" : "CREATE",
        note: `${type} uploaded by the customer after payment (website)`,
      });
      return saved;
    });
    if (existing?.fileUrl) await deleteUploadedFile(existing.fileUrl);

    return jsonSuccess({ id: document.id, passengerId, type, status: document.status }, 201);
  } catch (error) {
    console.error("[api/pay/documents]", error);
    return jsonError(500, "We couldn't save that file. Please try again.");
  }
}
