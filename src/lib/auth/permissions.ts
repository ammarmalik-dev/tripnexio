/**
 * Canonical permission catalog — the single source of truth for every
 * granular permission the CRM/Admin enforce server-side. `prisma/seed.ts`
 * creates exactly these rows; the Admin Roles screen reads them back from
 * the DB (via GET /api/admin/permissions) rather than hardcoding a second
 * copy, so this list only needs to change in one place.
 *
 * `admin.full` is the client's "top-level admin role" wildcard: every
 * `hasPermission()` check below treats it as satisfying any permission,
 * so a role holding only `admin.full` always has full access even if new
 * granular permissions are added later.
 */
export const ADMIN_FULL_PERMISSION = "admin.full";

export const PERMISSION_CATALOG: { name: string; description: string }[] = [
  { name: "leads.view", description: "View leads" },
  { name: "leads.edit", description: "Edit leads (status, assignment)" },
  { name: "quotations.view", description: "View quotations" },
  { name: "quotations.edit", description: "Build and select quotations" },
  { name: "bookings.view", description: "View bookings" },
  { name: "bookings.edit", description: "Create bookings and change their status" },
  { name: "payments.view", description: "View payments" },
  { name: "payments.edit", description: "Create payments and mark them successful" },
  { name: "refunds.view", description: "View refunds" },
  { name: "refunds.edit", description: "Calculate refunds and change their status" },
  { name: "documents.view", description: "View documents" },
  { name: "documents.edit", description: "Add documents and set their status" },
  { name: "staff.manage", description: "Create, edit, and deactivate staff accounts" },
  { name: "roles.manage", description: "Create roles and assign permissions" },
  {
    name: "masters.manage",
    description: "Manage master/config data: airports, airlines, borders, document requirements, vendors, pricing, coupons, FAQs, notification templates, tax/fee settings",
  },
  { name: "data.export", description: "Export core tables (customers, leads, bookings, payments) to CSV" },
  { name: ADMIN_FULL_PERMISSION, description: "Full system access — bypasses every other permission check" },
];

export interface PermissionCheckable {
  permissions: string[];
}

/** `admin.full` always passes — see module comment. Everything else is an exact permission-name match. */
export function hasPermission(session: PermissionCheckable | null, permission: string): boolean {
  if (!session) return false;
  return session.permissions.includes(ADMIN_FULL_PERMISSION) || session.permissions.includes(permission);
}

/** Every permission that unlocks the /admin/** section at all (each screen inside still checks its own specific permission). */
export const ADMIN_SECTION_PERMISSIONS = ["roles.manage", "staff.manage", "masters.manage", "data.export"];

export function canAccessAdminSection(session: PermissionCheckable | null): boolean {
  return ADMIN_SECTION_PERMISSIONS.some((permission) => hasPermission(session, permission));
}
