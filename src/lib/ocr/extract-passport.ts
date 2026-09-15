import { db } from "../db";
import { writeAudit } from "../audit/log";
import { readFileBytes } from "../storage/local-file-storage";
import { getOcrProvider } from "./get-provider";
import { callOcrProviderWithFailureAudit } from "./call-with-failure-audit";
import { parseMrz } from "./mrz-parser";
import { createTask } from "../tasks/create-task";
import type { PassportOcrFields } from "./types";
import type { DocumentExtraction } from "../../generated/prisma/client";

/**
 * Runs OCR on an already-uploaded passport Document and records the result
 * as a PENDING_REVIEW DocumentExtraction (extractionType PASSPORT) — never
 * touches the Passenger row itself (see PATCH /api/document-extractions/[id]
 * for the only path that does, and only on an explicit staff confirm).
 * Called right after upload from both trigger points: the CRM's
 * document-upload route and the customer-facing lead-intake routes that
 * accept an optional passport photo.
 */
export async function runPassportExtraction(documentId: string): Promise<DocumentExtraction> {
  const document = await db.document.findUnique({ where: { id: documentId }, include: { booking: { include: { lead: true } } } });
  if (!document) throw new Error("Document not found.");
  if (!document.fileUrl) throw new Error("Document has no file to read.");
  if (!document.passengerId) throw new Error("Document has no passenger to attach the extraction to.");

  const { base64, mimeType } = await readFileBytes(document.fileUrl);
  const provider = getOcrProvider();
  const result = await callOcrProviderWithFailureAudit(document.id, () => provider.extractPassport({ fileBase64: base64, mimeType }));

  const mrz = result.mrzRaw ? parseMrz(result.mrzRaw) : null;

  const mrzFields: PassportOcrFields = mrz
    ? {
        fullName: mrz.fields.fullName,
        passportNumber: mrz.fields.passportNumber,
        nationality: mrz.fields.nationality,
        dob: mrz.fields.dob,
        sex: mrz.fields.sex,
        expiryDate: mrz.fields.expiryDate,
        issuingCountry: mrz.fields.issuingCountry,
      }
    : {};

  // MRZ-derived values take priority when an MRZ was found at all (checksum
  // math makes it more trustworthy than free-text OCR of a stylized font),
  // filling any gaps from the provider's direct visual reading.
  const extractedFields: PassportOcrFields = mrz ? { ...result.fields, ...stripUndefined(mrzFields) } : result.fields;

  const extraction = await db.$transaction(async (tx) => {
    const created = await tx.documentExtraction.create({
      data: {
        documentId: document.id,
        passengerId: document.passengerId!,
        extractionType: "PASSPORT",
        provider: result.provider,
        extractedFields: extractedFields as object,
        mrzRaw: result.mrzRaw,
        mrzValid: mrz?.valid ?? false,
      },
    });
    await writeAudit(tx, {
      entityType: "DocumentExtraction",
      entityId: created.id,
      action: "CREATE",
      note: `Passport OCR ran on document ${document.id} via ${result.provider}${mrz ? ` (MRZ ${mrz.valid ? "valid" : "found but checksum mismatch"})` : " (no MRZ found)"}`,
    });

    // Step 17 (audit §3.8) — "OCR extraction pending review -> Manual
    // Verification Task," wired into this existing creation point.
    await createTask(tx, {
      type: "MANUAL_VERIFICATION",
      title: "Review passport OCR extraction",
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

function stripUndefined(fields: PassportOcrFields): PassportOcrFields {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as PassportOcrFields;
}
