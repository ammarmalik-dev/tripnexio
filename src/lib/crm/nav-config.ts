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
  Clock,
  Stamp,
  FileSignature,
  Settings,
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
 * Refunds, Documents, Tasks) / Profile (My Leave, added Step 38) — every
 * item that has a built CRM screen today. CRM.md §3 itself also lists
 * Resources/Analytics/Communication/Help groups (Vendors, Reports,
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
  {
    // Step 38 — CRM.md §3's Profile group, previously unbuilt (see doc
    // comment above) — this is the first screen in it.
    label: "Profile",
    items: [{ label: "My Leave", href: "/crm/my-leave", icon: CalendarOff }],
  },
];

/**
 * Step 46 (Admin FINAL handover §20, "Keep Sidebar Short") — grouped into
 * the client's own named sections, using `CrmNavGroup` (the same type
 * `crmNavGroups` already uses) so `AdminSidebar.tsx` can render both with
 * the same shape. This is UI-ONLY reorganization — every href/route below
 * is byte-identical to the old flat `adminNavItems` array it replaces, and
 * every screen's own API still enforces its own permission exactly as
 * before (see each route's own `requirePermission(...)` call) — this list
 * has never been the real access gate, only navigation, and that hasn't
 * changed.
 *
 * "AI Command Center" stays ungrouped at the top (`label: null`), mirroring
 * how `crmNavGroups` keeps "Command Centre" ungrouped — it's a standalone
 * tool, not a member of any of the client's 8 named categories.
 *
 * A few items don't map onto exactly one category the client's own list
 * defines unambiguously — placed by the closest fit, not a hard rule from
 * the handover doc, so flagged here:
 * - New Visa Countries / Return Ticket Destinations / Service Statuses /
 *   Protection Plan -> Service Configuration, alongside Pricing/Documents/
 *   Timelines (which §20 itself explicitly names as belonging there) —
 *   all four are per-service business config, same category of thing.
 * - Coupons -> Sales & Quotations (a sales/discount tool) rather than
 *   Finance & Invoices (which is reserved for money already collected/
 *   owed — Tax & Fees, Invoice Settings, Expenses).
 * - FAQs -> Service Configuration (per-service customer-facing content),
 *   not Reports & Exports or System Settings, neither of which fit.
 * - Notification Templates -> System Settings (system-wide communication
 *   config), not Service Configuration — these aren't scoped to one
 *   service, they're cross-cutting operational settings.
 * - Automation -> Reports & Exports — it's a read-only run-history
 *   monitor (Phase 5E), not an editable setting, so it reads more like a
 *   report than a "System Setting."
 */
export const adminNavGroups: CrmNavGroup[] = [
  { label: null, items: [{ label: "AI Command Center", href: "/admin/command-center", icon: Sparkles }] },
  {
    label: "People & Access",
    items: [
      { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
      { label: "Staff", href: "/admin/users", icon: UserCog },
      { label: "Staff Leave", href: "/admin/staff-leave", icon: CalendarOff },
      { label: "Bulk Reassignment", href: "/admin/bulk-reassignment", icon: Repeat },
    ],
  },
  {
    label: "Service Configuration",
    items: [
      { label: "Services", href: "/admin/services", icon: LayoutGrid },
      { label: "New Visa Countries", href: "/admin/new-visa-countries", icon: Stamp },
      { label: "Return Ticket Destinations", href: "/admin/return-ticket-destinations", icon: Ticket },
      { label: "Timelines / SLA", href: "/admin/timelines", icon: Clock },
      { label: "Document Requirements", href: "/admin/document-requirements", icon: ClipboardList },
      { label: "Pricing", href: "/admin/pricing", icon: Tags },
      { label: "Service Statuses", href: "/admin/service-statuses", icon: Waypoints },
      { label: "Protection Plan", href: "/admin/protection-plan", icon: ShieldCheck },
      { label: "FAQs", href: "/admin/faqs", icon: HelpCircle },
    ],
  },
  {
    label: "Master Data",
    items: [
      { label: "Countries", href: "/admin/countries", icon: Globe2 },
      { label: "Occupations", href: "/admin/occupations", icon: ClipboardList },
      { label: "Airports", href: "/admin/airports", icon: Building2 },
      { label: "Airlines", href: "/admin/airlines", icon: Plane },
      { label: "Borders", href: "/admin/borders", icon: Fence },
    ],
  },
  {
    label: "Vendors",
    items: [{ label: "Vendors", href: "/admin/vendors", icon: Truck }],
  },
  {
    label: "Sales & Quotations",
    items: [{ label: "Coupons", href: "/admin/coupons", icon: Ticket }],
  },
  {
    label: "Finance & Invoices",
    items: [
      { label: "Tax & Fees", href: "/admin/tax-fee", icon: Percent },
      { label: "Invoice Settings", href: "/admin/invoice-settings", icon: FileSignature },
      { label: "Expense Categories", href: "/admin/expense-categories", icon: Receipt },
      { label: "Expenses", href: "/admin/expenses", icon: Wallet },
    ],
  },
  {
    label: "Reports & Exports",
    items: [
      { label: "Data Export", href: "/admin/data-export", icon: Download },
      { label: "Automation", href: "/admin/automation", icon: Activity },
      { label: "P&L Report", href: "/admin/pnl-report", icon: TrendingUp },
    ],
  },
  {
    label: "System Settings",
    items: [
      { label: "Notification Templates", href: "/admin/notification-templates", icon: MessageSquareText },
      { label: "System Configuration", href: "/admin/system-config", icon: Settings },
    ],
  },
];
