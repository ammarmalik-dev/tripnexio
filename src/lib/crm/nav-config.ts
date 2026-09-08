import {
  LayoutDashboard,
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
  ClipboardList,
  Truck,
  Tags,
  Ticket,
  HelpCircle,
  MessageSquareText,
  Percent,
  Download,
  Activity,
  Globe2,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export interface CrmNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const crmNavItems: CrmNavItem[] = [
  // Just this one item, not a full reorg — CRM.md §3's grouped nav
  // structure (Command Centre / Sales / Operations / ...) is roadmap
  // Step 12's job. Without this, the new /crm dashboard (this step) would
  // be unreachable from the sidebar once staff navigate away from it.
  { label: "Command Centre", href: "/crm", icon: LayoutDashboard },
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
 * staff.manage, masters.manage, data.export, or admin.full — see the
 * Admin layout's server-side check. Every item is visible to anyone who
 * can enter /admin at all; each screen's own API additionally requires
 * its specific permission, so e.g. a masters-only admin lands on a "no
 * permission" error state if they click into Roles, Staff, or Data
 * Export (and vice versa) — the API 403 is the real gate, this list is
 * just navigation.
 */
export const adminNavItems: CrmNavItem[] = [
  { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
  { label: "Staff", href: "/admin/users", icon: UserCog },
  { label: "Countries", href: "/admin/countries", icon: Globe2 },
  { label: "Services", href: "/admin/services", icon: LayoutGrid },
  { label: "Airports", href: "/admin/airports", icon: Building2 },
  { label: "Airlines", href: "/admin/airlines", icon: Plane },
  { label: "Borders", href: "/admin/borders", icon: Fence },
  { label: "Document Requirements", href: "/admin/document-requirements", icon: ClipboardList },
  { label: "Vendors", href: "/admin/vendors", icon: Truck },
  { label: "Pricing", href: "/admin/pricing", icon: Tags },
  { label: "Coupons", href: "/admin/coupons", icon: Ticket },
  { label: "FAQs", href: "/admin/faqs", icon: HelpCircle },
  { label: "Notification Templates", href: "/admin/notification-templates", icon: MessageSquareText },
  { label: "Tax & Fees", href: "/admin/tax-fee", icon: Percent },
  { label: "Data Export", href: "/admin/data-export", icon: Download },
  { label: "Automation", href: "/admin/automation", icon: Activity },
];
