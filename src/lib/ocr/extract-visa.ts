import { db } from "../db";
import { writeAudit } from "../audit/log";
import { readFileBytes } from "../storage/local-file-storage";
import { getOcrProvider } from "./get-provider";
import { createTask } from "../tasks/create-task";
import type { DocumentExtraction } from "../../generated/prisma/client";

/**
 * CRM.md §18 (Step 16): "When a visa PDF is uploaded, CRM should extract
 * available: Passenger, Passport Number, Visa Number, Visa Type, Issue
 * Date, Expiry Date, Validity." Same never-auto-save architecture as
 * passport OCR (extract-passport.ts) — records a PENDING_REVIEW
 * DocumentExtraction, never writes anywhere else until an explicit staff
 * confirm (PATCH /api/document-extractions/[id]).
 */
export async function runVisaExtraction(documentId: string): Promise<DocumentExtraction> {
  const document = await db.document.findUnique({ where: { id: documentId }, include: { booking: { include: { lead: true } } } });
  if (!document) throw new Error("Document not found.");
  if (!document.fileUrl) throw new Error("Document has no file to read.");
  if (!document.passengerId && !document.bookingId) {
    throw new Error("Document has no passenger or booking to attach the extraction to.");
  }

  const { base64, mimeType } = await readFileBytes(document.fileUrl);
  const provider = getOcrProvider();
  const result = await provider.extractVisa({ fileBase64: base64, mimeType });

  const extraction = await db.$transaction(async (tx) => {
    const created = await tx.documentExtraction.create({
      data: {
        documentId: document.id,
        passengerId: document.passengerId,
        bookingId: document.bookingId,
        extractionType: "VISA",
        provider: result.provider,
        extractedFields: result.fields as object,
      },
    });
    await writeAudit(tx, {
      entityType: "DocumentExtraction",
      entityId: created.id,
      action: "CREATE",
      note: `Visa OCR ran on document ${document.id} via ${result.provider}`,
    });

    // Step 17 (audit §3.8) — "OCR extraction pending review -> Manual
    // Verification Task," wired into this existing creation point.
    await createTask(tx, {
      type: "MANUAL_VERIFICATION",
      title: "Review visa OCR extraction",
      reason: `${result.provider} extraction pending staff review`,
      entityType: "DocumentExtraction",
      entityId: created.id,
      leadId: document.booking?.leadId,
      bookingId: document.bookingId,
      passengerId: document.passengerId,
      serviceType: document.booking?.lead.serviceType,
    });

    return created;
  });

  return extraction;
}
