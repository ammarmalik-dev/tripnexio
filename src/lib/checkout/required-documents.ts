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

/**
 * Step 55 — the one place that decides which document-type list applies to
 * a given booking, New Visa's DB-backed lookup included. Both
 * `load-checkout.ts` (what the page shows) and
 * `/api/pay/[token]/documents` (what an upload is validated against) call
 * this instead of each picking a branch themselves — they'd drifted apart
 * once already: the upload route was calling the plain
 * `getCheckoutDocumentTypes()` directly, which has no New Visa entry, so
 * every New Visa post-payment upload was silently rejected with "That
 * document isn't needed for this service" even though the page correctly
 * listed New Visa's Admin-configured checklist.
 */
export async function resolveCheckoutDocumentTypes(booking: {
  lead: { serviceType: ServiceType; details: unknown };
}): Promise<CheckoutDocumentType[]> {
  if (booking.lead.serviceType !== "NEW_VISA") {
    return getCheckoutDocumentTypes(booking.lead.serviceType);
  }
  const details = (booking.lead.details ?? {}) as Record<string, unknown>;
  const countryCode = typeof details.destinationCountry === "string" ? details.destinationCountry : null;
  // Case-insensitive, same as the nationality match just below in
  // getNewVisaCheckoutDocumentTypes — the live New Visa form submits the
  // real Country.code (uppercase, from /api/countries), but findUnique on
  // `code` is exact-match only, so an older/differently-cased lead (e.g. a
  // pre-Admin-Country-model lead, or a manually-entered one) would
  // otherwise silently resolve to no country and no checklist at all.
  const country = countryCode
    ? await db.country.findFirst({ where: { code: { equals: countryCode, mode: "insensitive" } } })
    : null;
  return getNewVisaCheckoutDocumentTypes(country?.id ?? null);
}
