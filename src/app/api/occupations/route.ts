import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

/** Public, unauthenticated — the New Visa form's occupation dropdown (active options only, Admin-managed). */
export async function GET() {
  const occupations = await db.occupation.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return jsonSuccess(occupations);
}
