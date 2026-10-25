import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { requirePermission } from "@/lib/auth/require-permission";
import { db } from "@/lib/db";
import { runSequentially } from "@/lib/db-sequential";
import { BOOKING_STATUS_OPTIONS, LEAD_STATUS_OPTIONS, SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { REPORT_PAYMENT_STATUS_OPTIONS } from "@/lib/reports/types";

/**
 * P25 — dropdown options for the report filter bar: services, active
 * countries, active staff and active vendors; Admin handover §15 adds
 * sub-services (value "SERVICE_TYPE:code", with its service so the bar can
 * narrow them), lead / booking statuses and payment statuses. Queries run one after another
 * (the local prisma dev DB drops connections under parallel bursts).
 */
export async function GET() {
  try {
    const auth = await requirePermission("finance.manage");
    if (auth.error) return auth.error;

    const [countries, staff, vendors, subServices] = await runSequentially([
      () =>
        db.country.findMany({
          where: { active: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        }),
      () => db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      () => db.vendor.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      () =>
        db.subService.findMany({
          orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
          select: { serviceType: true, code: true, name: true, active: true },
        }),
    ]);

    return jsonSuccess({
      services: SERVICE_TYPE_OPTIONS,
      countries: countries.map((country) => ({ value: country.id, label: country.name })),
      staff: staff.map((user) => ({ value: user.id, label: user.name })),
      vendors: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
      subServices: subServices.map((row) => ({
        value: `${row.serviceType}:${row.code}`,
        label: `${SERVICE_TYPE_LABELS[row.serviceType]} · ${row.name}${row.active ? "" : " (inactive)"}`,
        serviceType: row.serviceType,
      })),
      leadStatuses: LEAD_STATUS_OPTIONS,
      bookingStatuses: BOOKING_STATUS_OPTIONS,
      paymentStatuses: REPORT_PAYMENT_STATUS_OPTIONS,
    });
  } catch (error) {
    console.error("[api/admin/reports/filters] failed", error);
    return jsonError(500, "Couldn't load the report filters. Please try again.");
  }
}
