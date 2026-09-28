import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

/** Public, unauthenticated — the Visa Change nationality picker (active options only, Admin-managed). */
export async function GET() {
  const nationalities = await db.nationality.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return jsonSuccess(nationalities);
}
