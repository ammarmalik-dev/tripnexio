import { db } from "../db";

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
    const customer = await db.customer.findUnique({ where: { mobile: input.mobile } });
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
