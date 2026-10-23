import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";

export interface CheckoutDocumentType {
  /** Stored as Document.type. */
  type: string;
  label: string;
  /** false = "where applicable": shown, but not counted as outstanding. */
  required: boolean;
}

/**
 * Services whose customer uploads documents on the checkout page after payment. Client doc 2026-10-20:
 * Special Fare (the Government ID of every passenger, A5) and Visa Change (the documents Admin configured
 * for the passengers' nationality, D10) too.
 */
const CHECKOUT_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>(["NEW_VISA", "RETURN_TICKET", "OTB", "FLIGHT_SPECIAL_FARE", "VISA_CHANGE"]);

/** Client doc 2026-10-20 (A5) — what a Special Fare passenger uploads when Admin hasn't listed documents for the service. */
const SPECIAL_FARE_DEFAULT_DOCUMENT: CheckoutDocumentType = { type: "Government ID", label: "Government ID / Passport", required: true };

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
export async function getNewVisaCheckoutDocumentTypes(countryId?: string | null, nationalityId?: string | null): Promise<CheckoutDocumentType[]> {
  // Client doc 2026-10-15 — New Visa documents are managed on the country's own New Visa page.
  const pageDocuments = await getNewVisaPageDocuments(countryId);
  if (pageDocuments.length > 0) return pageDocuments.map((name) => ({ type: name, label: name, required: true }));
  const nationality = nationalityId ? await db.nationality.findUnique({ where: { id: nationalityId }, select: { id: true, name: true } }) : null;
  const requirements = await db.documentRequirement.findMany({
    where: {
      serviceType: "NEW_VISA",
      active: true,
      OR: [
        { nationality: null, nationalityId: null },
        // Client 2026-10-23 audit — the traveller's chosen nationality (the form asks it now), not a hard-coded "India".
        ...(nationality ? [{ nationalityId: nationality.id }, { nationalityId: null, nationality: { equals: nationality.name, mode: "insensitive" as const } }] : []),
      ],
    },
    orderBy: [{ required: "desc" }, { documentName: "asc" }],
  });
  // countryId matched in JS, not the query, since it needs its own
  // independent null-or-exact-match semantics alongside the nationality OR above.
  const filtered = requirements.filter((requirement) => !requirement.countryId || requirement.countryId === countryId);
  return filtered.map((requirement) => ({ type: requirement.documentName, label: requirement.documentName, required: requirement.required }));
}

/**
 * Client doc 2026-10-15 — "Remove document management from the New Visa configuration page.
 * Manage documents on the respective country's New Visa page": the page's Documents list
 * (Admin → New Visa Pages). Empty = none set there (older Document Requirements rows still apply).
 */
export async function getNewVisaPageDocuments(countryId?: string | null): Promise<string[]> {
  if (!countryId) return [];
  const page = await db.newVisaCountryPage.findUnique({ where: { countryId }, select: { documents: true } });
  return (page?.documents ?? []).map((name) => name.trim()).filter(Boolean);
}

/**
 * Client doc 2026-10-20 (D10) — a Visa Change booking's documents: Admin's Visa Change document rows that apply
 * to every nationality or to one of the booking's passengers' nationalities.
 */
async function getVisaChangeDocumentTypes(bookingId: string | undefined): Promise<CheckoutDocumentType[]> {
  const passengers = bookingId
    ? await db.bookingPassenger.findMany({ where: { bookingId }, select: { passenger: { select: { nationality: true, nationalityId: true } } } })
    : [];
  const nationalityIds = passengers.map((row) => row.passenger.nationalityId).filter((id): id is string => !!id);
  const nationalityNames = passengers.map((row) => row.passenger.nationality?.trim()).filter((name): name is string => !!name);
  const requirements = await db.documentRequirement.findMany({
    where: {
      serviceType: "VISA_CHANGE",
      active: true,
      OR: [
        { nationality: null, nationalityId: null },
        ...(nationalityIds.length ? [{ nationalityId: { in: nationalityIds } }] : []),
        ...nationalityNames.map((name) => ({ nationalityId: null, nationality: { equals: name, mode: "insensitive" as const } })),
      ],
    },
    orderBy: [{ required: "desc" }, { documentName: "asc" }],
  });
  const seen = new Set<string>();
  return requirements
    .filter((requirement) => (seen.has(requirement.documentName) ? false : (seen.add(requirement.documentName), true)))
    .map((requirement) => ({ type: LEGACY_TYPE_CODES[requirement.documentName.trim().toLowerCase()] ?? requirement.documentName, label: requirement.documentName, required: requirement.required }));
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
  id?: string;
  customerId?: string;
  linkedBookingId?: string | null;
  lead: { serviceType: ServiceType; details: unknown };
}): Promise<CheckoutDocumentType[]> {
  const { serviceType } = booking.lead;
  if (!CHECKOUT_SERVICES.has(serviceType)) return [];
  const details = (booking.lead.details ?? {}) as Record<string, unknown>;
  const countryCode = typeof details.destinationCountry === "string" ? details.destinationCountry : null;
  // Case-insensitive, same as the nationality name match in
  // getNewVisaCheckoutDocumentTypes — the live New Visa form submits the
  // real Country.code (uppercase, from /api/countries), but findUnique on
  // `code` is exact-match only, so an older/differently-cased lead (e.g. a
  // pre-Admin-Country-model lead, or a manually-entered one) would
  // otherwise silently resolve to no country and no checklist at all.
  const country = countryCode
    ? await db.country.findFirst({ where: { code: { equals: countryCode, mode: "insensitive" } } })
    : null;
  if (serviceType === "NEW_VISA") {
    return getNewVisaCheckoutDocumentTypes(country?.id ?? null, typeof details.nationalityId === "string" ? details.nationalityId : null);
  }
  if (serviceType === "VISA_CHANGE") return getVisaChangeDocumentTypes(booking.id);
  const types = await getRequirementDocumentTypes(serviceType, country?.id ?? null);
  if (serviceType === "FLIGHT_SPECIAL_FARE") return types.length > 0 ? types : [SPECIAL_FARE_DEFAULT_DOCUMENT];
  return serviceType === "OTB" ? markTicketsTripNexioProvides(types, booking) : types;
}

/**
 * P18 — OTB for a recognised customer: when their flight ticket was bought
 * from TripNexio (a Special Fare booking whose ticket was delivered) the
 * flight-ticket upload is skipped, and when the return ticket comes from
 * TripNexio (a linked Return Verified Ticket booking) so is the return
 * ticket. Skipped = shown as not required (TripNexio already has it), so an
 * upload is still accepted if the customer sends one anyway.
 */
async function markTicketsTripNexioProvides(
  types: CheckoutDocumentType[],
  booking: { id?: string; customerId?: string; linkedBookingId?: string | null }
): Promise<CheckoutDocumentType[]> {
  if (!booking.customerId) return types;
  const [flightFromTripNexio, linked] = await Promise.all([
    db.booking.findFirst({
      where: {
        customerId: booking.customerId,
        lead: { serviceType: "FLIGHT_SPECIAL_FARE" },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
        documents: { some: { type: "TICKET_PDF", deliveredAt: { not: null } } },
      },
      select: { id: true },
    }),
    booking.linkedBookingId
      ? db.booking.findUnique({ where: { id: booking.linkedBookingId }, select: { lead: { select: { serviceType: true } } } })
      : null,
  ]);
  const returnFromTripNexio = linked?.lead.serviceType === "RETURN_TICKET";
  return types.map((type) => {
    if (flightFromTripNexio && type.type === "ONWARD_TICKET") return { ...type, required: false, label: `${type.label} (booked with TripNexio — not needed)` };
    if (returnFromTripNexio && type.type === "RETURN_TICKET") return { ...type, required: false, label: `${type.label} (issued by TripNexio — not needed)` };
    return type;
  });
}
