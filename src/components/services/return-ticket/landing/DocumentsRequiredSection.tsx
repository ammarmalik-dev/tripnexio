import type { RequiredDocument } from "@/components/services/ServiceRequirementsSection";

export interface ReturnTicketLandingDocument {
  name: string;
  required: boolean;
}

// Locked content — RVT Page Content v3 §7. Used verbatim when an Admin row's
// name matches one of the doc's documents (return ticket removed 2026-10-09, B12), and as the whole list when
// the Admin checklist can't be read.
const DOC_CAPTIONS: Record<string, string> = {
  "passport copy": "Required",
  "visa copy": "Optional / where applicable",
};

const FALLBACK_DOCUMENTS: ReturnTicketLandingDocument[] = [
  { name: "Passport Copy", required: true },
  { name: "Visa Copy", required: false },
];

/**
 * P19 — "Documents required" for the shared requirements layout. `documents`
 * is the Admin-managed DocumentRequirement checklist for RETURN_TICKET (null
 * when it couldn't be loaded, in which case the doc's own list is shown).
 */
export function returnTicketDocumentsForDisplay(documents: ReturnTicketLandingDocument[] | null): RequiredDocument[] {
  const list = documents && documents.length > 0 ? documents : FALLBACK_DOCUMENTS;
  // Client testing 2026-10-09 (B12) — the return ticket is what we issue, so it is never listed as a customer document.
  return list
    .filter((doc) => doc.name.trim().toLowerCase() !== "return ticket")
    .map((doc) => ({ ...doc, caption: DOC_CAPTIONS[doc.name.trim().toLowerCase()] }));
}
