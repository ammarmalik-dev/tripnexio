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
  { name: "leads.edit", description: "Edit lead status and claim/assign an unassigned lead" },
  {
    name: "leads.reassign",
    description: "Reassign a lead that's already assigned to someone else, or unassign it — staff cannot reassign leads on their own",
  },
  { name: "quotations.view", description: "View quotations" },
  { name: "quotations.edit", description: "Build and select quotations" },
  { name: "bookings.view", description: "View bookings" },
  { name: "bookings.edit", description: "Create bookings and change their status" },
  { name: "payments.view", description: "View payments" },
  { name: "payments.edit", description: "Create payments and mark them successful" },
  { name: "refunds.view", description: "View refunds" },
  { name: "refunds.edit", description: "Calculate/raise refunds (status stays Pending until approved)" },
  {
    name: "refunds.approve",
    description: "Approve or reject a raised refund (move it to Processing/Completed/Rejected) — staff cannot approve their own refunds",
  },
  { name: "documents.view", description: "View documents" },
  { name: "documents.edit", description: "Add documents and set their status" },
  { name: "tasks.view", description: "View tasks" },
  { name: "tasks.edit", description: "Assign tasks and change their status" },
  { name: "staff.manage", description: "Create, edit, and deactivate staff accounts" },
  {
    name: "staff.leave.approve",
    description: "Approve or reject a staff member's leave request — staff can request their own leave (starts Pending) but cannot approve it",
  },
  { name: "roles.manage", description: "Create roles and assign permissions" },
  {
    name: "masters.manage",
    description: "Manage master/config data: airports, airlines, borders, document requirements, vendors, pricing, coupons, FAQs, notification templates, tax/fee settings",
  },
  { name: "data.export", description: "Export core tables (customers, leads, bookings, payments) to CSV" },
  { name: "automation.view", description: "View background automation (n8n workflow) run history and health" },
  { name: "ai.assist", description: "Use the Admin AI Command Center — natural-language read-only queries across bookings, refunds, payments, staff workload, and integration health" },
  { name: "finance.manage", description: "Record/edit expenses and view the P&L report — ADMIN.md §29: internal vendor cost and margin must remain Admin-only" },
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

/**
 * Every permission that unlocks the /admin/** section at all (each screen
 * inside still checks its own specific permission). leads.reassign joined
 * this list in Step 26 — without it, a role holding ONLY leads.reassign
 * (and none of the other admin-only permissions) would be redirected away
 * by the Admin layout's own gate before ever reaching the Bulk
 * Reassignment screen its permission is specifically meant to unlock. See
 * feedback_admin_section_all_or_nothing_gating in project memory for the
 * general shape of this gotcha.
 */
export const ADMIN_SECTION_PERMISSIONS = ["roles.manage", "staff.manage", "masters.manage", "data.export", "automation.view", "leads.reassign", "ai.assist", "finance.manage"];

export function canAccessAdminSection(session: PermissionCheckable | null): boolean {
  return ADMIN_SECTION_PERMISSIONS.some((permission) => hasPermission(session, permission));
}
