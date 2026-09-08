import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";

/**
 * Lightweight, session-only lookup for the CRM's Visa Change border-picker
 * (VisaChangeBorderDetailsPanel) -- same pattern as /api/vendors vs.
 * /api/admin/vendors: any signed-in staff member can read this, only
 * masters.manage can edit the underlying Border master via /api/admin/borders.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const borders = await db.border.findMany({
    where: { active: true, activeForVisaChange: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return jsonSuccess(borders.map((border) => ({ id: border.id, name: border.name })));
}
