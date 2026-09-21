import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

/**
 * Public, unauthenticated — the Return Ticket form's destination list.
 * Active destinations only (and only where the country itself is still
 * active), with the Admin-configured per-applicant rate and allowed
 * visa-validity options. Rates are meant to be customer-visible.
 */
export async function GET() {
  const destinations = await db.returnTicketDestination.findMany({
    where: { active: true, country: { active: true } },
    orderBy: [{ displayOrder: "asc" }, { country: { name: "asc" } }],
    include: { country: { select: { id: true, name: true } } },
  });
  return jsonSuccess(
    destinations.map((d) => ({
      countryId: d.countryId,
      countryName: d.country.name,
      ratePerApplicant: Number(d.ratePerApplicant),
      validityOptions: d.validityOptions,
    }))
  );
}
