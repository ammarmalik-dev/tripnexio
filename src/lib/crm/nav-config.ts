import {
  ListChecks,
  Users,
  FileText,
  CalendarCheck,
  CreditCard,
  RotateCcw,
  FolderOpen,
  ShieldCheck,
  UserCog,
  Plane,
  Building2,
  Fence,
  type LucideIcon,
} from "lucide-react";

export interface CrmNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const crmNavItems: CrmNavItem[] = [
  { label: "Leads", href: "/crm/leads", icon: ListChecks },
  { label: "Customers", href: "/crm/customers", icon: Users },
  { label: "Quotations", href: "/crm/quotations", icon: FileText },
  { label: "Bookings", href: "/crm/bookings", icon: CalendarCheck },
  { label: "Payments", href: "/crm/payments", icon: CreditCard },
  { label: "Refunds", href: "/crm/refunds", icon: RotateCcw },
  { label: "Documents", href: "/crm/documents", icon: FolderOpen },
];

/**
 * Only shown/reachable to staff whose role grants roles.manage,
 * staff.manage, masters.manage, or admin.full — see the Admin layout's
 * server-side check. Every item is visible to anyone who can enter /admin
 * at all; each screen's own API additionally requires its specific
 * permission, so a masters-only admin lands on a "no permission" error
 * state if they click into Roles or Staff (and vice versa) — the API 403
 * is the real gate, this list is just navigation.
 */
export const adminNavItems: CrmNavItem[] = [
  { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
  { label: "Staff", href: "/admin/users", icon: UserCog },
  { label: "Airports", href: "/admin/airports", icon: Building2 },
  { label: "Airlines", href: "/admin/airlines", icon: Plane },
  { label: "Borders", href: "/admin/borders", icon: Fence },
];
