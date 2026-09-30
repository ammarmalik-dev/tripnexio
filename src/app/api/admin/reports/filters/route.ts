import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { db } from "@/lib/db";
import { runSequentially } from "@/lib/db-sequential";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";

/**
 * P25 — dropdown options for the report filter bar: services, active
 * countries, active staff and active vendors. Queries run one after another
 * (the local prisma dev DB drops connections under parallel bursts).
 */
export async function GET() {
  try {
    const auth = await requirePermission("finance.manage");
    if (auth.error) return auth.error;

    const [countries, staff, vendors] = await runSequentially([
      () =>
        db.country.findMany({
          where: { active: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        }),
      () => db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      () => db.vendor.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

    return jsonSuccess({
      services: SERVICE_TYPE_OPTIONS,
      countries: countries.map((country) => ({ value: country.id, label: country.name })),
      staff: staff.map((user) => ({ value: user.id, label: user.name })),
      vendors: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
    });
  } catch (error) {
    console.error("[api/admin/reports/filters] failed", error);
    return jsonError(500, "Couldn't load the report filters. Please try again.");
  }
}
