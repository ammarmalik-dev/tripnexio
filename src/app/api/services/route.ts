import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

/**
 * Public, unauthenticated — feeds the homepage services grid (and any
 * future customer-facing surface) with the Admin-editable service metadata.
 * Active-only, ordered. No sensitive fields on Service, so no session
 * check needed.
 */
export async function GET() {
  const services = await db.service.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, shortDescription: true, iconName: true },
  });
  return jsonSuccess(services);
}
