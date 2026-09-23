import { db } from "../db";
import { writeAudit } from "../audit/log";
import { saveUploadedFile } from "../storage/local-file-storage";
import { runPassportExtraction } from "./extract-passport";

/**
 * The customer-flow trigger point — called by a lead-intake route right
 * after createLeadFromSubmission() succeeds, when the customer attached a
 * document photo (PassportUploadField.tsx). Deliberately never throws: this
 * is an enhancement on top of an already-created Lead, and a storage/OCR
 * hiccup must never look like the submission itself failed. If it fails,
 * it's just logged — the customer gets no error, staff simply won't see the
 * document (or, for a passport, its OCR review) for that passenger.
 *
 * `documentType` defaults to "PASSPORT" (its original, only use before
 * Visa Extension/Visa Change also started requiring a Visa Copy) — OCR
 * extraction only ever runs for that type, since the OCR pipeline
 * specifically parses passport MRZ data, not visa documents.
 */
export async function handleOptionalPassportUpload(input: {
  passengerId: string;
  imageBase64?: string;
  mimeType?: string;
  documentType?: string;
}): Promise<void> {
  if (!input.imageBase64 || !input.mimeType) return;
  const documentType = input.documentType ?? "PASSPORT";

  try {
    const { url } = await saveUploadedFile(input.imageBase64, input.mimeType, documentType === "PASSPORT" ? "passports" : "documents");
    const document = await db.document.create({
      data: { passengerId: input.passengerId, type: documentType, status: "RECEIVED", fileUrl: url },
    });
    await writeAudit(db, {
      entityType: "Document",
      entityId: document.id,
      action: "CREATE",
      note: `${documentType === "PASSPORT" ? "Passport photo" : "Document"} uploaded via website intake form`,
    });
    if (documentType === "PASSPORT") {
      await runPassportExtraction(document.id);
    }
  } catch (error) {
    console.error("[handleOptionalPassportUpload]", error);
  }
}
