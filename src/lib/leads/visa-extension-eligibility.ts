import { db } from "../db";
import { findCustomerByMobile } from "../customers/find-by-mobile";
import { leadReference } from "./reference";

export interface VisaExtensionEligibilityInput {
  passportNumber?: string;
  /** ISO date string (YYYY-MM-DD). */
  dob?: string;
  mobile?: string;
}

export interface VisaExtensionEligibilityResult {
  eligible: boolean;
  matchedLeadId?: string;
}

/**
 * client-message/Visa_Extension.md §2/§25: "TripNexio initially processes
 * Visa Extension only for visas originally issued through TripNexio... No
 * Extension Booking is created until an eligible TripNexio visa is
 * identified." There's no dedicated Visa/VisaRecord entity in this schema
 * (only Lead/Booking), so this is a deliberate, documented proxy: a
 * NEW_VISA Lead for this customer that reached CONVERTED (i.e. was
 * actually paid, not just requested) counts as "a visa originally issued
 * through TripNexio." Revisit if the client wants something stricter
 * (e.g. only after the New Visa's own Booking reached a "visa delivered"
 * outcome — that status granularity doesn't exist yet either, see the
 * per-service status engine gap in AUDIT_REPORT.md §3.9/§7.3).
 *
 * Matches by passport+DOB (the spec's "new/unknown customer" path, §3) OR
 * by mobile (the spec's "existing customer, registered mobile" path) --
 * either one finding a match is sufficient.
 */
export async function checkVisaExtensionEligibility(
  input: VisaExtensionEligibilityInput
): Promise<VisaExtensionEligibilityResult> {
  const customerIds = new Set<string>();

  if (input.mobile) {
    const customer = await findCustomerByMobile(db, input.mobile);
    if (customer) customerIds.add(customer.id);
  }

  if (input.passportNumber && input.dob) {
    const dobDate = new Date(input.dob);
    if (!Number.isNaN(dobDate.getTime())) {
      const passengers = await db.passenger.findMany({
        where: { passportNumber: { equals: input.passportNumber, mode: "insensitive" }, dob: dobDate },
        select: { customerId: true },
      });
      for (const passenger of passengers) customerIds.add(passenger.customerId);
    }
  }

  if (customerIds.size === 0) return { eligible: false };

  const matchedLead = await db.lead.findFirst({
    where: { customerId: { in: Array.from(customerIds) }, serviceType: "NEW_VISA", status: "CONVERTED" },
    orderBy: { createdAt: "desc" },
  });

  return matchedLead ? { eligible: true, matchedLeadId: matchedLead.id } : { eligible: false };
}

/** §2/§25: the redirect shown when no eligible TripNexio visa is found — inside UAE -> Visa Change, outside UAE -> New Visa. */
export function getIneligibleRedirect(insideUAE: "yes" | "no"): { service: "VISA_CHANGE" | "NEW_VISA"; href: string; label: string } {
  return insideUAE === "yes"
    ? { service: "VISA_CHANGE", href: "/services/visa-change", label: "Visa Change" }
    : { service: "NEW_VISA", href: "/services/new-visa", label: "New Visa" };
}

export interface PriorTripNexioVisa {
  leadId: string;
  /** The earlier New Visa lead's reference. */
  referenceId: string;
  createdAt: Date;
  /** Booking ID of the earlier visa, when one exists. */
  bookingId: string | null;
  /** P13 — that booking's row id (for Booking.originalBookingId). */
  bookingRecordId: string | null;
  /** Captured on the earlier New Visa request — shown to staff as-is, never guessed. */
  destinationCountry: string | null;
  visaType: string | null;
  travelDate: string | null;
}

/**
 * Staff-facing lookup (Visa Extension handover doc): "check each applicant's
 * Passport Number against existing records to verify whether the applicant
 * previously received a visa through TripNexio." Passport-number-only, unlike
 * checkVisaExtensionEligibility above (which also needs DOB and is the
 * WhatsApp bot's gate). Uses the same proxy for "received a visa": a NEW_VISA
 * Lead that reached CONVERTED. Returns the most recent match, or null.
 */
export async function findPriorTripNexioVisaByPassport(passportNumber: string): Promise<PriorTripNexioVisa | null> {
  const passengers = await db.passenger.findMany({
    where: { passportNumber: { equals: passportNumber.trim(), mode: "insensitive" } },
    select: { customerId: true },
  });
  if (passengers.length === 0) return null;

  const lead = await db.lead.findFirst({
    where: {
      customerId: { in: Array.from(new Set(passengers.map((p) => p.customerId))) },
      serviceType: "NEW_VISA",
      status: "CONVERTED",
    },
    orderBy: { createdAt: "desc" },
    // Prefer a live booking over a cancelled/refunded one.
    include: { bookings: { orderBy: [{ createdAt: "desc" }], select: { id: true, bookingId: true, status: true } } },
  });
  if (!lead) return null;

  const preferred = lead.bookings.find((booking) => booking.status !== "CANCELLED" && booking.status !== "REFUNDED") ?? lead.bookings[0] ?? null;
  const details = (lead.details ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  return {
    leadId: lead.id,
    referenceId: leadReference(lead),
    createdAt: lead.createdAt,
    bookingId: preferred?.bookingId ?? null,
    bookingRecordId: preferred?.id ?? null,
    destinationCountry: text(details.destinationCountry),
    visaType: text(details.visaType),
    travelDate: text(details.travelDate),
  };
}

/** P13 — every applicant passport on a Visa Extension lead (primary first), de-duplicated. */
export function extensionApplicantPassports(details: unknown): { fullName: string; passportNumber: string }[] {
  const data = (details ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(data.applicants) ? (data.applicants as Record<string, unknown>[]) : [];
  const list = rows
    .map((row) => ({ fullName: typeof row.fullName === "string" ? row.fullName : "", passportNumber: typeof row.passportNumber === "string" ? row.passportNumber.trim() : "" }))
    .filter((row) => row.passportNumber);
  if (list.length === 0 && typeof data.passportNumber === "string" && data.passportNumber.trim()) {
    list.push({ fullName: "", passportNumber: data.passportNumber.trim() });
  }
  const seen = new Set<string>();
  return list.filter((row) => {
    const key = row.passportNumber.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** P13 — the original New Visa booking a Visa Extension lead extends: the first applicant (primary first) with a matched prior TripNexio visa booking. */
export async function findOriginalBookingForExtension(details: unknown): Promise<string | null> {
  for (const applicant of extensionApplicantPassports(details)) {
    const match = await findPriorTripNexioVisaByPassport(applicant.passportNumber);
    if (match?.bookingRecordId) return match.bookingRecordId;
  }
  return null;
}
