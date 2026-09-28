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

export function getAllowedNextDocumentStatuses(current: DocumentStatus): DocumentStatus[] {
  return ALLOWED[current];
}

export function assertValidDocumentTransition(current: DocumentStatus, next: DocumentStatus): string | null {
  if (current === next) return `This document is already ${next.toLowerCase()}.`;
  if (!ALLOWED[current].includes(next)) return `A ${current.toLowerCase()} document can't be moved to ${next.toLowerCase()}.`;
  return null;
}
