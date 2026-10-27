export type OcrDocumentKind = "PASSPORT" | "TICKET" | "VISA";

/**
 * Which OCR pipeline fits a document type code (Admin Document Master codes are free-form, e.g. PASSPORT,
 * PASSPORT_FRONT_PAGE, RETURN_TICKET, VISA_COPY). Client doc 2026-10-27 (C9) — one upload per document runs
 * OCR whenever the type supports it. A passport photograph or the passport's last / back page has no bio-data
 * page or MRZ, so it is not read as a passport. Null = no OCR for this type.
 */
export function ocrKindForDocumentType(type: string): OcrDocumentKind | null {
  if (/passport/i.test(type)) return /(photo|last|back|address)/i.test(type) ? null : "PASSPORT";
  if (/ticket/i.test(type)) return "TICKET";
  if (/visa/i.test(type)) return "VISA";
  return null;
}
