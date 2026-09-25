import type { NextRequest } from "next/server";
import { accountDocumentUploadSchema } from "@/lib/validation/account-document-upload-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage/local-file-storage";
import { runPassportExtraction } from "@/lib/ocr/extract-passport";
import { runTicketExtraction } from "@/lib/ocr/extract-ticket";
import { runVisaExtraction } from "@/lib/ocr/extract-visa";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Step 55 — the customer's own upload against a Document a staff member
 * already requested (status REQUIRED/MISSING), reached from `/account`
 * rather than a booking token — this is what covers "anything requested
 * after the fact" for a service with no `/pay/<token>` page at all (Visa
 * Extension, Visa Change, Flight Special Fare), and also just works for
 * any other service's post-conversion document requests too.
 *
 * Session-gated by `getCustomerSession()`, not a booking token — every
 * other check here (does this Document belong to THIS customer) exists
 * because of that: a signed-in customer could otherwise pass any Document
 * id.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getCustomerSession();
  if (!session) return jsonError(401, "Please sign in to upload a document.");

  const { id } = await params;

  const existing = await db.document.findUnique({
    where: { id },
    include: { booking: true, passenger: true },
  });
  if (!existing) return jsonError(404, "Document not found.");

  const belongsToCustomer =
    existing.booking?.customerId === session.id || existing.passenger?.customerId === session.id;
  if (!belongsToCustomer) return jsonError(404, "Document not found.");

  if (existing.status !== "REQUIRED" && existing.status !== "MISSING") {
    return jsonError(409, "This document has already been received.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = accountDocumentUploadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the file and try again.", parsed.error.flatten().fieldErrors);
  }

  let fileUrl: string;
  try {
    const saved = await saveUploadedFile(parsed.data.fileBase64, parsed.data.mimeType, "documents");
    fileUrl = saved.url;
  } catch (error) {
    console.error("[account/documents/upload] file save failed", error);
    return jsonError(400, "Couldn't save that file. Please try a JPEG, PNG, GIF, WebP, or PDF.");
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.document.update({
      where: { id },
      data: { fileUrl, status: "RECEIVED" },
    });
    await writeAudit(tx, {
      entityType: "Document",
      entityId: id,
      action: "UPLOAD",
      note: `File attached; status ${existing.status} -> RECEIVED (by the customer, account page)`,
    });
    return result;
  });

  if (existing.fileUrl && existing.fileUrl !== fileUrl) {
    void deleteUploadedFile(existing.fileUrl);
  }

  // Same OCR triggers as the staff upload route (PATCH /api/documents/[id]/upload) — never blocks the upload response if it fails.
  try {
    if (/passport/i.test(updated.type) && updated.passengerId) {
      await runPassportExtraction(updated.id);
    } else if (/ticket/i.test(updated.type)) {
      await runTicketExtraction(updated.id);
    } else if (/visa/i.test(updated.type)) {
      await runVisaExtraction(updated.id);
    }
  } catch (error) {
    console.error("[account/documents/upload] OCR failed", error);
  }

  return jsonSuccess({ id: updated.id, status: updated.status });
}
