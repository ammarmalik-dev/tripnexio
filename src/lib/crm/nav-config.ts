import {
  LayoutDashboard,
  ListChecks,
  Users,
  FileText,
  CalendarCheck,
  CreditCard,
  RotateCcw,
  FolderOpen,
  ListTodo,
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
  Waypoints,
  CalendarOff,
  Repeat,
  Sparkles,
  Receipt,
  Wallet,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface CrmNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface CrmNavGroup {
  /** null = no group heading (Command Centre stands alone at the top). */
  label: string | null;
  items: CrmNavItem[];
}

/**
 * CRM.md §3's grouped nav structure (Step 12, audit §3.1) — Command Centre /
 * Sales (Leads, Customers, Quotations) / Operations (Bookings, Payments,
 * Refunds, Documents, Tasks) — every item that has a built CRM screen today
 * (Tasks added Step 17, audit §3.8). CRM.md §3 itself also lists Resources/
 * Analytics/Communication/Help/Profile groups (Vendors, Reports,
 * Notifications, Knowledge Base, etc.), none of which have a built CRM
 * screen yet, so none are added here — this reorganizes existing
 * navigation, it doesn't invent new destinations.
 */
export const crmNavGroups: CrmNavGroup[] = [
  { label: null, items: [{ label: "Command Centre", href: "/crm", icon: LayoutDashboard }] },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/crm/leads", icon: ListChecks },
      { label: "Customers", href: "/crm/customers", icon: Users },
      { label: "Quotations", href: "/crm/quotations", icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Bookings", href: "/crm/bookings", icon: CalendarCheck },
      { label: "Payments", href: "/crm/payments", icon: CreditCard },
      { label: "Refunds", href: "/crm/refunds", icon: RotateCcw },
      { label: "Documents", href: "/crm/documents", icon: FolderOpen },
      { label: "Tasks", href: "/crm/tasks", icon: ListTodo },
    ],
  },
];

/**
 * Only shown/reachable to staff whose role grants roles.manage,
 * staff.manage, masters.manage, data.export, leads.reassign, ai.assist
 * (added Step 26/27 — see ADMIN_SECTION_PERMISSIONS's own doc comment), or
 * admin.full — see the Admin layout's server-side check. Every item is visible to anyone who
 * can enter /admin at all; each screen's own API additionally requires
 * its specific permission, so e.g. a masters-only admin lands on a "no
 * permission" error state if they click into Roles, Staff, or Data
 * Export (and vice versa) — the API 403 is the real gate, this list is
 * just navigation.
 */
export const adminNavItems: CrmNavItem[] = [
  { label: "AI Command Center", href: "/admin/command-center", icon: Sparkles },
  { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
  { label: "Staff", href: "/admin/users", icon: UserCog },
  { label: "Staff Leave", href: "/admin/staff-leave", icon: CalendarOff },
  { label: "Bulk Reassignment", href: "/admin/bulk-reassignment", icon: Repeat },
  { label: "Countries", href: "/admin/countries", icon: Globe2 },
  { label: "Services", href: "/admin/services", icon: LayoutGrid },
  { label: "Return Ticket Destinations", href: "/admin/return-ticket-destinations", icon: Ticket },
  { label: "Occupations", href: "/admin/occupations", icon: ClipboardList },
  { label: "OTB Timelines", href: "/admin/otb-rules", icon: Percent },
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
  { label: "Service Statuses", href: "/admin/service-statuses", icon: Waypoints },
  { label: "Protection Plan", href: "/admin/protection-plan", icon: ShieldCheck },
  { label: "Expense Categories", href: "/admin/expense-categories", icon: Receipt },
  { label: "Expenses", href: "/admin/expenses", icon: Wallet },
  { label: "P&L Report", href: "/admin/pnl-report", icon: TrendingUp },
];
