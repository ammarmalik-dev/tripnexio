import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";

export interface CheckoutDocumentType {
  /** Stored as Document.type. */
  type: string;
  label: string;
  /** false = "where applicable": shown, but not counted as outstanding. */
  required: boolean;
}

/** Services whose customer uploads documents on the checkout page after payment. */
const CHECKOUT_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>(["NEW_VISA", "RETURN_TICKET", "OTB"]);

/**
 * Return Ticket/OTB documents were a hard-coded list before P06, stored with
 * these Document.type codes. Their Admin-managed rows keep mapping to the
 * same codes so documents uploaded before the move still line up; any other
 * row uses its own name as the type, the same as New Visa.
 */
const LEGACY_TYPE_CODES: Record<string, string> = {
  "passport copy": "PASSPORT",
  "visa copy": "VISA_COPY",
  "onward ticket": "ONWARD_TICKET",
  "return ticket": "RETURN_TICKET",
};

/**
 * Return Ticket/OTB post-payment checklist, from Admin-managed
 * DocumentRequirement rows (seeded per RVT Page Content v3 §7 and OTB's
 * previous fixed list). Neither service collects nationality, so only rows
 * without a nationality apply; `countryId` narrows by destination country.
 */
async function getRequirementDocumentTypes(serviceType: ServiceType, countryId: string | null): Promise<CheckoutDocumentType[]> {
  const requirements = await db.documentRequirement.findMany({
    where: { serviceType, active: true, nationality: null, nationalityId: null },
    orderBy: [{ required: "desc" }, { documentName: "asc" }],
  });
  return requirements
    .filter((requirement) => !requirement.countryId || requirement.countryId === countryId)
    .map((requirement) => ({
      type: LEGACY_TYPE_CODES[requirement.documentName.trim().toLowerCase()] ?? requirement.documentName,
      label: requirement.documentName,
      required: requirement.required,
    }));
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
      OR: [
        { nationality: null, nationalityId: null },
        { nationalityRef: { name: { equals: NEW_VISA_DEFAULT_NATIONALITY, mode: "insensitive" } } },
        { nationalityId: null, nationality: { equals: NEW_VISA_DEFAULT_NATIONALITY, mode: "insensitive" } },
      ],
    },
    orderBy: [{ required: "desc" }, { documentName: "asc" }],
  });
  // countryId matched in JS, not the query, since it needs its own
  // independent null-or-exact-match semantics alongside the nationality OR above.
  const filtered = requirements.filter((requirement) => !requirement.countryId || requirement.countryId === countryId);
  return filtered.map((requirement) => ({ type: requirement.documentName, label: requirement.documentName, required: requirement.required }));
}

export function isCheckoutService(serviceType: ServiceType): boolean {
  return CHECKOUT_SERVICES.has(serviceType);
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
  const { serviceType } = booking.lead;
  if (!CHECKOUT_SERVICES.has(serviceType)) return [];
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
  if (serviceType === "NEW_VISA") return getNewVisaCheckoutDocumentTypes(country?.id ?? null);
  return getRequirementDocumentTypes(serviceType, country?.id ?? null);
}
