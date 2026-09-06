import { ListChecks, Users, FileText, CalendarCheck, CreditCard, RotateCcw, FolderOpen, type LucideIcon } from "lucide-react";

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
