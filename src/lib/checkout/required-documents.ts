import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";

export interface CheckoutDocumentType {
  /** Stored as Document.type. */
  type: string;
  label: string;
}

/**
 * Documents asked for AFTER payment on Return Ticket/OTB — exactly the
 * lists in the client's Developer Handover documents (Return Ticket:
 * Passport Copy, Visa Copy, Onward Ticket; OTB: those plus Return Ticket).
 * Each is collected per applicant. New Visa's post-payment checklist isn't
 * a fixed list like these — see `getNewVisaCheckoutDocumentTypes` below.
 */
const REQUIRED_DOCUMENTS: Partial<Record<ServiceType, CheckoutDocumentType[]>> = {
  RETURN_TICKET: [
    { type: "PASSPORT", label: "Passport copy" },
    { type: "VISA_COPY", label: "Visa copy" },
    { type: "ONWARD_TICKET", label: "Onward ticket" },
  ],
  OTB: [
    { type: "PASSPORT", label: "Passport copy" },
    { type: "VISA_COPY", label: "Visa copy" },
    { type: "ONWARD_TICKET", label: "Onward ticket" },
    { type: "RETURN_TICKET", label: "Return ticket" },
  ],
};

export function getCheckoutDocumentTypes(serviceType: ServiceType): CheckoutDocumentType[] {
  return REQUIRED_DOCUMENTS[serviceType] ?? [];
}

/**
 * Default nationality used to look up New Visa's Admin-configured document
 * checklist (`DocumentRequirement`) — New Visa's own form never asks for
 * nationality (the market scope is India-to-GCC, so it's implicitly
 * India), unlike Visa Change which collects it explicitly. A judgment
 * call, not a guess about document *names* — those still come entirely
 * from whatever Admin has configured, never invented here.
 */
export const NEW_VISA_DEFAULT_NATIONALITY = "India";

/**
 * New Visa's post-payment checklist (New_Visa.md's locked flow step 16:
 * "Document upload," after Booking ID creation) isn't a fixed list the
 * client gave verbatim the way Return Ticket/OTB's were — it comes from the
 * same Admin-managed `DocumentRequirement` checklist Visa Change's pre-lead
 * step already reads. Nothing here is invented: an empty Admin checklist
 * means an empty document-upload step, not a fabricated fallback list.
 *
 * Step 41 (Admin FINAL handover §5): matched on `countryId` too now, not
 * just nationality — a row applies when every dimension it sets matches
 * (null on the row = applies universally on that axis), same semantics as
 * `buildDocumentChecklistSnapshot`. `countryId` is optional since not
 * every caller can resolve New Visa's destination country (e.g. a
 * standalone check before a lead exists).
 */
export async function getNewVisaCheckoutDocumentTypes(countryId?: string | null): Promise<CheckoutDocumentType[]> {
  const requirements = await db.documentRequirement.findMany({
    where: {
      serviceType: "NEW_VISA",
      active: true,
      OR: [{ nationality: null }, { nationality: { equals: NEW_VISA_DEFAULT_NATIONALITY, mode: "insensitive" } }],
    },
    orderBy: [{ required: "desc" }, { documentName: "asc" }],
  });
  // countryId matched in JS, not the query, since it needs its own
  // independent null-or-exact-match semantics alongside the nationality OR above.
  const filtered = requirements.filter((requirement) => !requirement.countryId || requirement.countryId === countryId);
  return filtered.map((requirement) => ({ type: requirement.documentName, label: requirement.documentName }));
}

export function isCheckoutService(serviceType: ServiceType): boolean {
  return serviceType === "NEW_VISA" || serviceType in REQUIRED_DOCUMENTS;
}
