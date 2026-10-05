import type { RequiredDocument } from "@/components/services/ServiceRequirementsSection";

export interface ReturnTicketLandingDocument {
  name: string;
  required: boolean;
}

// Locked content — RVT Page Content v3 §7. Used verbatim when an Admin row's
// name matches one of the doc's three documents, and as the whole list when
// the Admin checklist can't be read.
const DOC_CAPTIONS: Record<string, string> = {
  "passport copy": "Required",
  "return ticket": "Provide existing ticket details where applicable",
  "visa copy": "Optional / where applicable",
};

const FALLBACK_DOCUMENTS: ReturnTicketLandingDocument[] = [
  { name: "Passport Copy", required: true },
  { name: "Return Ticket", required: false },
  { name: "Visa Copy", required: false },
];

/**
 * P19 — "Documents required" for the shared requirements layout. `documents`
 * is the Admin-managed DocumentRequirement checklist for RETURN_TICKET (null
 * when it couldn't be loaded, in which case the doc's own list is shown).
 */
export function returnTicketDocumentsForDisplay(documents: ReturnTicketLandingDocument[] | null): RequiredDocument[] {
  const list = documents && documents.length > 0 ? documents : FALLBACK_DOCUMENTS;
  return list.map((doc) => ({ ...doc, caption: DOC_CAPTIONS[doc.name.trim().toLowerCase()] }));
}
