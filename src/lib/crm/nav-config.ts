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
  Ticket,
  HelpCircle,
  MessageSquareText,
  Percent,
  Download,
  Activity,
  Globe2,
  LayoutGrid,
  CalendarOff,
  Repeat,
  Sparkles,
  Receipt,
  Wallet,
  TrendingUp,
  Stamp,
  FileSignature,
  Settings,
  BookOpen,
  Gauge,
  BarChart3,
  Undo2,
  Flag,
  CalendarDays,
  AlarmClock,
  CalendarClock,
  UserCircle,
  LifeBuoy,
  SlidersHorizontal,
  History,
  ScrollText,
  ScanText,
  Radio,
  Workflow,
  Siren,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";

export interface CrmNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * P21 item 7 — the permission this screen's own API requires. Omitted =
   * visible to every signed-in staff member (e.g. Command Centre, My Leave).
   * UI courtesy only: every route still enforces its own permission
   * server-side regardless of what the sidebar shows.
   */
  permission?: string;
  /** Visible when the user holds ANY of these (checked in addition to `permission`, if both are set). */
  anyOf?: string[];
}

export interface CrmNavGroup {
  /** null = no group heading (Command Centre stands alone at the top). */
  label: string | null;
  items: CrmNavItem[];
}

/**
 * CRM.md §3's grouped nav structure (Step 12, audit §3.1) — Command Centre /
 * Sales (Leads, Customers, Quotations) / Operations (Bookings, Payments,
 * Refunds, Documents, Tasks) / Profile (My Leave, added Step 38) / Resources
 * (Knowledge Centre, added Item 14 — PENDING_WORK_PROMPTS.md) — every item
 * that has a built CRM screen today. CRM.md §3 itself also lists
 * Analytics/Communication/Help groups (Reports, Notifications, etc.), none
 * of which have a built CRM screen yet, so none are added here — this
 * reorganizes existing navigation, it doesn't invent new destinations.
 */
export const crmNavGroups: CrmNavGroup[] = [
  { label: null, items: [{ label: "Command Centre", href: "/crm", icon: LayoutDashboard }] },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/crm/leads", icon: ListChecks, permission: "leads.view" },
      { label: "Customers", href: "/crm/customers", icon: Users, permission: "leads.view" },
      { label: "Quotations", href: "/crm/quotations", icon: FileText, permission: "quotations.view" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Bookings", href: "/crm/bookings", icon: CalendarCheck, permission: "bookings.view" },
      { label: "Payments", href: "/crm/payments", icon: CreditCard, permission: "payments.view" },
      { label: "Refunds", href: "/crm/refunds", icon: RotateCcw, permission: "refunds.view" },
      { label: "Documents", href: "/crm/documents", icon: FolderOpen, permission: "documents.view" },
      { label: "Tasks", href: "/crm/tasks", icon: ListTodo, permission: "tasks.view" },
      // P21 item 9 — CRM.md §3/§30 "Delay Analysis" (Operations group).
      { label: "Delay Analysis", href: "/crm/delays", icon: AlarmClock, permission: "bookings.view" },
    ],
  },
  {
    // P16 — Flight_Special_Fare.md §25 Phase 1 analytics.
    label: "Analytics",
    items: [
      // P22 item 3 — CRM.md §29 Reports.
      { label: "Reports", href: "/crm/reports", icon: TrendingUp, permission: "leads.view" },
      { label: "Special Fare Analytics", href: "/crm/analytics/special-fare", icon: BarChart3, permission: "leads.view" },
    ],
  },
  {
    // Step 38 — CRM.md §3's Profile group, previously unbuilt (see doc
    // comment above) — this is the first screen in it.
    label: "Profile",
    items: [
      // P22 item 5 — CRM.md §31 Profile & Security (own account only, no permission).
      { label: "My Profile", href: "/crm/profile", icon: UserCircle },
      { label: "My Leave", href: "/crm/my-leave", icon: CalendarOff },
    ],
  },
  {
    // Item 14 (PENDING_WORK_PROMPTS.md) — CRM.md §3/§77's Resources group,
    // previously unbuilt (see doc comment above) — this is the first screen
    // in it. P22 item 6 — Vendors (CRM.md §24) now has a read-only staff
    // view here; vendor CRUD stays Admin-only (/admin/vendors, masters.manage).
    label: "Resources",
    items: [
      { label: "Knowledge Centre", href: "/crm/knowledge-centre", icon: BookOpen, permission: "knowledge.view" },
      { label: "Vendors", href: "/crm/vendors", icon: Truck, permission: "quotations.view" },
    ],
  },
  {
    // P22 item 2 — CRM.md §3/§28 Help group. No permission: every signed-in
    // staff member can search help and report an issue.
    label: "Help",
    items: [{ label: "Help", href: "/crm/help", icon: LifeBuoy }],
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
 * - P23 item 1: Pricing / Documents / Timelines / Service Statuses /
 *   Service Terms / Refund Configuration / Protection Plan / New Visa
 *   Countries / Return Ticket Destinations / OTB Prices are no longer
 *   separate items — they are tabs of the one "Service Configuration" hub
 *   (/admin/service-configuration); their old URLs redirect there.
 * - Coupons -> Sales & Quotations (a sales/discount tool) rather than
 *   Finance & Invoices (which is reserved for money already collected/
 *   owed — Tax & Fees, Invoice Settings, Expenses).
 * - FAQs -> Service Configuration (per-service customer-facing content),
 *   not Reports & Exports or System Settings, neither of which fit.
 * - Notification Templates -> System Settings (system-wide communication
 *   config), not Service Configuration — these aren't scoped to one
 *   service, they're cross-cutting operational settings.
 * - P24: Automation moved from Reports & Exports into the new
 *   "Monitoring" group, alongside the other read-only system-health /
 *   oversight screens (Live Activity, OCR Monitor, Audit Log,
 *   Configuration History).
 * - P24: "Operations" holds the read-only Admin Bookings search plus the
 *   SLA Escalation rules; Assignment Rules sits in People & Access next to
 *   Bulk Reassignment (both decide who works which lead).
 */
export const adminNavGroups: CrmNavGroup[] = [
  { label: null, items: [{ label: "AI Command Center", href: "/admin/command-center", icon: Sparkles, permission: "ai.assist" }] },
  {
    // P24 — read-only cross-service booking search + SLA escalation rules.
    label: "Operations",
    items: [
      { label: "Bookings", href: "/admin/bookings", icon: CalendarCheck, permission: "bookings.view" },
      { label: "SLA Escalation", href: "/admin/escalations", icon: Siren, permission: "staff.manage" },
    ],
  },
  {
    // P24 — live/system oversight screens, all read-only.
    label: "Monitoring",
    items: [
      { label: "Live Activity", href: "/admin/live-activity", icon: Radio, permission: "automation.view" },
      { label: "OCR Monitor", href: "/admin/ocr-monitor", icon: ScanText, permission: "automation.view" },
      { label: "Automation", href: "/admin/automation", icon: Activity, permission: "automation.view" },
      { label: "Audit Log", href: "/admin/audit-log", icon: ScrollText, permission: "staff.manage" },
      { label: "Configuration History", href: "/admin/config-history", icon: History, permission: "masters.manage" },
    ],
  },
  {
    label: "People & Access",
    items: [
      { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck, permission: "roles.manage" },
      { label: "Staff", href: "/admin/users", icon: UserCog, permission: "staff.manage" },
      { label: "Staff Leave", href: "/admin/staff-leave", icon: CalendarOff, permission: "staff.manage" },
      { label: "Staff Roster", href: "/admin/roster", icon: CalendarClock, permission: "staff.manage" },
      { label: "Bulk Reassignment", href: "/admin/bulk-reassignment", icon: Repeat, permission: "leads.reassign" },
      { label: "Assignment Rules", href: "/admin/assignment-rules", icon: Workflow, permission: "staff.manage" },
    ],
  },
  {
    label: "Service Configuration",
    items: [
      { label: "Services", href: "/admin/services", icon: LayoutGrid, permission: "masters.manage" },
      // P23 item 1 (Admin FINAL handover §3/§20) — ONE hub replaces the separate
      // Pricing / Documents / Timelines / Statuses / Terms / Refund Config /
      // Protection Plan / New Visa Countries / Return Ticket Destinations /
      // OTB Prices items (their old URLs redirect into the hub's matching tab).
      { label: "Service Configuration", href: "/admin/service-configuration", icon: SlidersHorizontal, permission: "masters.manage" },
      { label: "Pricing Dashboard", href: "/admin/pricing-dashboard", icon: Gauge, permission: "masters.manage" },
      { label: "Holidays", href: "/admin/holidays", icon: CalendarDays, permission: "masters.manage" },
      { label: "FAQs", href: "/admin/faqs", icon: HelpCircle, permission: "masters.manage" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { label: "Countries", href: "/admin/countries", icon: Globe2, permission: "masters.manage" },
      { label: "Nationalities", href: "/admin/nationalities", icon: Flag, permission: "masters.manage" },
      { label: "Visa Types", href: "/admin/visa-types", icon: Stamp, permission: "masters.manage" },
      { label: "Occupations", href: "/admin/occupations", icon: ClipboardList, permission: "masters.manage" },
      { label: "Airports", href: "/admin/airports", icon: Building2, permission: "masters.manage" },
      { label: "Airlines", href: "/admin/airlines", icon: Plane, permission: "masters.manage" },
      { label: "Borders", href: "/admin/borders", icon: Fence, permission: "masters.manage" },
    ],
  },
  {
    label: "Vendors",
    items: [
      { label: "Vendors", href: "/admin/vendors", icon: Truck, permission: "masters.manage" },
      { label: "Vendor Scoring", href: "/admin/vendor-scoring", icon: Gauge, permission: "masters.manage" },
    ],
  },
  {
    label: "Sales & Quotations",
    items: [{ label: "Coupons", href: "/admin/coupons", icon: Ticket, permission: "masters.manage" }],
  },
  {
    label: "Payments & Finance",
    items: [
      { label: "Payment Gateway", href: "/admin/payment-gateway", icon: Landmark, permission: "masters.manage" },
      { label: "Tax & Fees", href: "/admin/tax-fee", icon: Percent, permission: "masters.manage" },
      { label: "Invoice Settings", href: "/admin/invoice-settings", icon: FileSignature, permission: "masters.manage" },
      { label: "Expense Categories", href: "/admin/expense-categories", icon: Receipt, permission: "masters.manage" },
      { label: "Expenses", href: "/admin/expenses", icon: Wallet, permission: "finance.manage" },
    ],
  },
  {
    label: "Reports & Exports",
    items: [
      { label: "Data Export", href: "/admin/data-export", icon: Download, permission: "data.export" },
      { label: "P&L Report", href: "/admin/pnl-report", icon: TrendingUp, permission: "finance.manage" },
      { label: "Revenue Report", href: "/admin/revenue-report", icon: BarChart3, permission: "finance.manage" },
      { label: "Refund Report", href: "/admin/refund-report", icon: Undo2, permission: "finance.manage" },
    ],
  },
  {
    label: "System Settings",
    items: [
      { label: "Notification Templates", href: "/admin/notification-templates", icon: MessageSquareText, permission: "masters.manage" },
      { label: "System Configuration", href: "/admin/system-config", icon: Settings, permission: "masters.manage" },
    ],
  },
];

/**
 * P21 item 7 — the sidebar's permission filter. Drops every item the user
 * can't open (`admin.full` passes everything, via `hasPermission`), then
 * drops any group left with no items. A UI courtesy only — see
 * `CrmNavItem.permission`.
 */
export function canSeeNavItem(item: CrmNavItem, permissions: string[]): boolean {
  const session = { permissions };
  if (item.permission && !hasPermission(session, item.permission)) return false;
  if (item.anyOf && item.anyOf.length > 0 && !item.anyOf.some((permission) => hasPermission(session, permission))) return false;
  return true;
}

export function filterNavGroups(groups: CrmNavGroup[], permissions: string[]): CrmNavGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => canSeeNavItem(item, permissions)) }))
    .filter((group) => group.items.length > 0);
}
