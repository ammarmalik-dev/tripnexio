import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

/**
 * Public, unauthenticated — read-only reference data for customer-facing
 * destination-country dropdowns (website forms, WhatsApp bot). Active-only,
 * ordered. No sensitive fields on Country, so no session check needed.
 */
export async function GET() {
  const countries = await db.country.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true },
  });
  return jsonSuccess(countries);
}
