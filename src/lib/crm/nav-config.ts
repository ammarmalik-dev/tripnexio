import { ListChecks, Users, FileText, CalendarCheck, CreditCard, RotateCcw, FolderOpen, ShieldCheck, UserCog, type LucideIcon } from "lucide-react";

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

/** Only shown/reachable to staff whose role grants roles.manage, staff.manage, or admin.full — see the Admin layout's server-side check. */
export const adminNavItems: CrmNavItem[] = [
  { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
  { label: "Staff", href: "/admin/users", icon: UserCog },
];
