import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";

/** P14 — staff lookup for the A2A panel: active airports enabled for A2A entry and for A2A exit (Airport master flags). */
export async function GET() {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Please sign in.");
  try {
    const select = { id: true, name: true, code: true } as const;
    const orderBy = [{ displayOrder: "asc" as const }, { name: "asc" as const }];
    const [entry, exit] = await Promise.all([
      db.airport.findMany({ where: { active: true, activeForA2AEntry: true }, select, orderBy }),
      db.airport.findMany({ where: { active: true, activeForA2AExit: true }, select, orderBy }),
    ]);
    return jsonSuccess({ entry, exit });
  } catch (error) {
    console.error("[api/visa-change/a2a-airports]", error);
    return jsonError(500, "Couldn't load the airports.");
  }
}
