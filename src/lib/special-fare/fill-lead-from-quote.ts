import type { Prisma } from "../../generated/prisma/client";

/**
 * Client doc 16 Nov (A7) — an offline (manual) flight lead often has no route of its own; once a quotation names the
 * airports, the lead takes what it is missing from it: its Country (the arrival airport's country) and the origin /
 * destination cities its CRM lists and Service Details show. Never overwrites anything the lead already has.
 */
export async function fillFlightLeadFromQuote(
  tx: Prisma.TransactionClient,
  leadId: string,
  airports: { fromAirportCode?: string | null; toAirportCode?: string | null }
): Promise<void> {
  if (!airports.fromAirportCode || !airports.toAirportCode) return;
  const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { serviceType: true, countryId: true, details: true } });
  if (!lead || lead.serviceType !== "FLIGHT_SPECIAL_FARE") return;
  const details = (lead.details ?? {}) as Record<string, unknown>;
  const missingRoute = !details.origin || !details.destination;
  if (lead.countryId && !missingRoute) return;

  const rows = await tx.airport.findMany({
    where: { code: { in: [airports.fromAirportCode, airports.toAirportCode] } },
    select: { code: true, city: true, name: true, countryId: true },
  });
  const from = rows.find((row) => row.code === airports.fromAirportCode);
  const to = rows.find((row) => row.code === airports.toAirportCode);
  if (!from || !to) return;
  // Same shape the website's airport field stores ("City - Airport name (CODE)"), so every reader handles it.
  const label = (row: { city: string; name: string; code: string }) => `${row.city} - ${row.name} (${row.code})`;

  await tx.lead.update({
    where: { id: leadId },
    data: {
      ...(lead.countryId ? {} : { countryId: to.countryId }),
      ...(missingRoute
        ? {
            details: {
              ...details,
              ...(details.origin ? {} : { origin: label(from) }),
              ...(details.destination ? {} : { destination: label(to) }),
              ...(details.toAirportCode ? {} : { toAirportCode: to.code }),
              routeFromQuotation: true,
            } as Prisma.InputJsonObject,
          }
        : {}),
    },
  });
}
