import { db } from "../db";
import { writeAudit } from "../audit/log";
import { saveUploadedImage } from "../storage/local-file-storage";
import { runPassportExtraction } from "./extract-passport";

/**
 * The customer-flow trigger point — called by a lead-intake route right
 * after createLeadFromSubmission() succeeds, when the customer attached an
 * optional passport photo (PassportUploadField.tsx). Deliberately never
 * throws: this is a nice-to-have enhancement on top of an already-created
 * Lead, and a storage/OCR hiccup must never look like the submission itself
 * failed. If it fails, it's just logged — the customer gets no error, staff
 * simply won't see a PassportExtraction to review for that passenger.
 */
export async function handleOptionalPassportUpload(input: { passengerId: string; imageBase64?: string; mimeType?: string }): Promise<void> {
  if (!input.imageBase64 || !input.mimeType) return;

  try {
    const { url } = await saveUploadedImage(input.imageBase64, input.mimeType, "passports");
    const document = await db.document.create({
      data: { passengerId: input.passengerId, type: "PASSPORT", status: "RECEIVED", fileUrl: url },
    });
    await writeAudit(db, {
      entityType: "Document",
      entityId: document.id,
      action: "CREATE",
      note: "Passport photo uploaded via website intake form",
    });
    await runPassportExtraction(document.id);
  } catch (error) {
    console.error("[handleOptionalPassportUpload]", error);
  }
}
