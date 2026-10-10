import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { runSequentially } from "@/lib/db-sequential";
import { requirePermission } from "@/lib/auth/require-permission";

/**
 * P24 item 5 — option lists for the Admin Bookings filter bar (staff,
 * vendors, countries, per-service booking statuses). Includes inactive
 * staff/vendors so historic bookings stay filterable after someone leaves
 * or a vendor is disabled. Same permission as the list itself.
 */
export async function GET() {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  try {
    const [staff, vendors, countries, serviceStatuses] = await runSequentially([
      () => (db.user.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } })),
      () => (db.vendor.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } })),
      () => (db.country.findMany({ where: { active: true }, select: { id: true, name: true, code: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] })),
      () => (db.serviceStatus.findMany({
        where: { scope: "BOOKING" },
        select: { id: true, name: true, customerLabel: true, serviceType: true, active: true },
        orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }],
      }))]);
    return jsonSuccess({ staff, vendors, countries, serviceStatuses });
  } catch (error) {
    console.error("[api/admin/bookings/filters]", error);
    return jsonError(500, "Couldn't load filter options.");
  }
}
