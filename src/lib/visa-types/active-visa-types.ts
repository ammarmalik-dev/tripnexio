import { db } from "../db";

/**
 * Active New Visa "Visa Type" options for a destination country code: rows
 * scoped to that country plus rows offered for every country. Shared by the
 * public list endpoint, the lead-intake route's server-side check, and the
 * WhatsApp bot, so all three always agree.
 */
export async function getActiveVisaTypes(countryCode: string) {
  return db.visaType.findMany({
    where: {
      active: true,
      OR: [
        { countryId: null },
        ...(countryCode ? [{ country: { code: { equals: countryCode, mode: "insensitive" as const } } }] : []),
      ],
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}
