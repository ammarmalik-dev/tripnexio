import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { writeAudit } from "../audit/log";

export interface EffectiveTerms {
  id: string;
  version: number;
  title: string;
  body: string;
}

/**
 * The Terms & Conditions a customer agrees to before paying for a service
 * (P09): the highest active version for that destination country, else the
 * highest active version that applies to every country. Null when Admin
 * hasn't published any — the customer then agrees to the general website
 * Terms (/legal/terms), still recorded on the booking.
 */
export async function getEffectiveTerms(serviceType: ServiceType, countryId: string | null): Promise<EffectiveTerms | null> {
  const select = { id: true, version: true, title: true, body: true } as const;
  if (countryId) {
    const countryTerms = await db.serviceTerms.findFirst({ where: { serviceType, countryId, active: true }, orderBy: { version: "desc" }, select });
    if (countryTerms) return countryTerms;
  }
  return db.serviceTerms.findFirst({ where: { serviceType, countryId: null, active: true }, orderBy: { version: "desc" }, select });
}

/**
 * The destination country (Country.id) a lead's details point at — New
 * Visa/OTB store a country code, Return Ticket a country id. Null when the
 * service has no destination.
 */
export async function resolveLeadCountryId(details: unknown): Promise<string | null> {
  const data = (details ?? {}) as Record<string, unknown>;
  if (typeof data.destinationCountryId === "string") return data.destinationCountryId;
  if (typeof data.destinationCountry === "string" && data.destinationCountry) {
    const country = await db.country.findFirst({
      where: { OR: [{ code: { equals: data.destinationCountry, mode: "insensitive" } }, { name: { equals: data.destinationCountry, mode: "insensitive" } }] },
      select: { id: true },
    });
    return country?.id ?? null;
  }
  return null;
}

/**
 * Records the customer's acceptance on the booking: the terms version, when,
 * and from which IP. The first acceptance is kept; later calls are no-ops.
 * Looks the terms up first, then writes the booking + audit row together.
 */
export async function recordTermsAcceptance(
  booking: { id: string; termsAcceptedAt: Date | null; lead: { serviceType: ServiceType; details: unknown } },
  ip: string,
  actorLabel: string
): Promise<void> {
  if (booking.termsAcceptedAt) return;
  const terms = await getEffectiveTerms(booking.lead.serviceType, await resolveLeadCountryId(booking.lead.details));
  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { termsId: terms?.id ?? null, termsVersion: terms?.version ?? null, termsAcceptedAt: new Date(), termsAcceptedIp: ip },
    });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: booking.id,
      action: "TERMS_ACCEPTED",
      note: terms
        ? `Customer accepted "${terms.title}" v${terms.version} (${actorLabel}, IP ${ip})`
        : `Customer accepted the general website Terms & Conditions (${actorLabel}, IP ${ip})`,
    });
  });
}
