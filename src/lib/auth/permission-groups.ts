import { ADMIN_FULL_PERMISSION } from "./permissions";

/**
 * How the Roles & Permissions screen groups the permission catalog.
 * UI-only: grouping never changes what a permission does, and every route
 * still enforces its own permission server-side. A permission that exists
 * in the database but isn't listed here falls into "Other" so it can never
 * disappear from the screen. `admin.full` is shown on its own as the
 * "Full access" switch, not inside a group.
 */
export interface PermissionGroupDefinition {
  key: string;
  title: string;
  description: string;
  /** Permission names, in display order, each with a short label. */
  permissions: { name: string; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroupDefinition[] = [
  {
    key: "sales",
    title: "Sales",
    description: "Leads, customers and quotations",
    permissions: [
      { name: "leads.view", label: "View leads & customers" },
      { name: "leads.edit", label: "Edit leads" },
      { name: "leads.reassign", label: "Reassign leads" },
      { name: "quotations.view", label: "View quotations" },
      { name: "quotations.edit", label: "Build & select quotations" },
    ],
  },
  {
    key: "operations",
    title: "Operations",
    description: "Bookings, documents and tasks",
    permissions: [
      { name: "bookings.view", label: "View bookings" },
      { name: "bookings.edit", label: "Create & update bookings" },
      { name: "documents.view", label: "View documents" },
      { name: "documents.edit", label: "Add & verify documents" },
      { name: "tasks.view", label: "View tasks" },
      { name: "tasks.edit", label: "Assign & update tasks" },
    ],
  },
  {
    key: "payments",
    title: "Payments & Refunds",
    description: "Collecting money, invoices and refunds",
    permissions: [
      { name: "payments.view", label: "View payments & invoices" },
      { name: "payments.edit", label: "Create payments" },
      { name: "payments.approve", label: "Approve bank transfers" },
      { name: "refunds.view", label: "View refunds" },
      { name: "refunds.edit", label: "Raise refunds" },
      { name: "refunds.approve", label: "Approve refunds" },
    ],
  },
  {
    key: "finance",
    title: "Finance & Reports",
    description: "Internal costs, margins, reports and exports",
    permissions: [
      { name: "finance.manage", label: "Finance, expenses & reports" },
      { name: "vendors.viewCost", label: "See vendor cost" },
      { name: "data.export", label: "Export data (CSV)" },
    ],
  },
  {
    key: "people",
    title: "People & Access",
    description: "Staff accounts, leave and roles",
    permissions: [
      { name: "staff.manage", label: "Manage staff accounts" },
      { name: "staff.leave.approve", label: "Approve staff leave" },
      { name: "roles.manage", label: "Manage roles & permissions" },
    ],
  },
  {
    key: "configuration",
    title: "Configuration & System",
    description: "Masters, pricing, automation and AI tools",
    permissions: [
      { name: "masters.manage", label: "Manage masters & settings" },
      { name: "automation.view", label: "View automation & monitoring" },
      { name: "ai.assist", label: "Use AI Command Center" },
    ],
  },
  {
    key: "knowledge",
    title: "Knowledge Centre",
    description: "Internal SOPs and training material",
    permissions: [
      { name: "knowledge.view", label: "View Knowledge Centre" },
      { name: "knowledge.edit", label: "Edit Knowledge Centre" },
    ],
  },
];

export interface ResolvedPermission {
  name: string;
  label: string;
  description: string | null;
}

export interface ResolvedPermissionGroup {
  key: string;
  title: string;
  description: string;
  permissions: ResolvedPermission[];
}

/**
 * Joins the grouping above with the permissions that actually exist in the
 * database (their descriptions come from there). Unknown names go to "Other";
 * groups with no existing permissions are dropped; admin.full is excluded.
 */
export function resolvePermissionGroups(available: { name: string; description: string | null }[]): ResolvedPermissionGroup[] {
  const byName = new Map(available.map((permission) => [permission.name, permission]));
  const placed = new Set<string>([ADMIN_FULL_PERMISSION]);
  const groups: ResolvedPermissionGroup[] = [];

  for (const group of PERMISSION_GROUPS) {
    const permissions = group.permissions
      .filter((entry) => byName.has(entry.name))
      .map((entry) => {
        placed.add(entry.name);
        return { name: entry.name, label: entry.label, description: byName.get(entry.name)?.description ?? null };
      });
    if (permissions.length > 0) groups.push({ key: group.key, title: group.title, description: group.description, permissions });
  }

  const other = available
    .filter((permission) => !placed.has(permission.name))
    .map((permission) => ({ name: permission.name, label: permission.name, description: permission.description }));
  if (other.length > 0) groups.push({ key: "other", title: "Other", description: "Permissions not in a category yet", permissions: other });

  return groups;
}
