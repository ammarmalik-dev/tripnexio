import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";

/**
 * Lightweight active-airlines lookup for CRM pickers (Flight Special Fare /
 * Return Ticket quote builder) — mirrors GET /api/vendors vs. the full
 * /api/admin/vendors CRUD. Distinct from the OTB-specific GET
 * /api/otb/airlines (public, filtered to `otbRequired: true`, no `id`,
 * keyed by `code` alone) — this route is staff-gated, filters only on
 * `active` (every active airline is usable here, not just OTB-eligible
 * ones), and includes `id` since it's the general-purpose shared list §9
 * of the Admin FINAL handover asks for.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const airlines = await db.airline.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return jsonSuccess(airlines.map((airline) => ({ id: airline.id, code: airline.code, name: airline.name })));
}
