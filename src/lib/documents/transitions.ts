import type { DocumentStatus } from "../../generated/prisma/enums";

/**
 * Allowed staff status changes for a document: REQUIRED/MISSING -> RECEIVED
 * -> VERIFIED or REJECTED, and REJECTED -> RECEIVED (a re-submitted copy).
 * REQUIRED -> MISSING stays allowed so staff can flag an outstanding
 * document to the customer. VERIFIED is final.
 */
const ALLOWED: Record<DocumentStatus, DocumentStatus[]> = {
  REQUIRED: ["MISSING", "RECEIVED"],
  MISSING: ["RECEIVED"],
  RECEIVED: ["VERIFIED", "REJECTED"],
  REJECTED: ["RECEIVED"],
  VERIFIED: [],
};

/** Statuses that say a file is there (uploaded, validated, rejected) — client doc 16 Nov (F5): never without one. */
const NEEDS_FILE = new Set<DocumentStatus>(["RECEIVED", "VERIFIED", "REJECTED"]);

/** The next statuses staff may pick; without an uploaded file only "missing" is left (client doc 16 Nov, F5). */
export function getAllowedNextDocumentStatuses(current: DocumentStatus, hasFile = true): DocumentStatus[] {
  return ALLOWED[current].filter((next) => hasFile || !NEEDS_FILE.has(next));
}

/** Client doc 16 Nov (F5) — "Uploaded / Validated / Rejected" only for a document whose file was really uploaded. */
export function documentFileBlock(next: DocumentStatus, file: { fileUrl: string | null; purgedAt: Date | null }): string | null {
  if (!NEEDS_FILE.has(next) || (file.fileUrl && !file.purgedAt)) return null;
  return "No file has been uploaded for this document yet — it can't be marked uploaded, validated or rejected.";
}

export function assertValidDocumentTransition(current: DocumentStatus, next: DocumentStatus): string | null {
  if (current === next) return `This document is already ${next.toLowerCase()}.`;
  if (!ALLOWED[current].includes(next)) return `A ${current.toLowerCase()} document can't be moved to ${next.toLowerCase()}.`;
  return null;
}
