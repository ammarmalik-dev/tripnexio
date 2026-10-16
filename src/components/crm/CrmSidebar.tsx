"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { crmNavGroups, filterNavGroups, type CrmNavItem } from "@/lib/crm/nav-config";
import { DashboardSidebar } from "./DashboardSidebar";
import { cn } from "@/lib/cn";

/**
 * `permissions` (P21 item 7) — the signed-in user's permission names, from
 * the (authenticated) layout's getStaffSession(). Items the user can't open
 * are hidden (admin.full sees everything). UI courtesy only — every CRM
 * route/API still enforces its own permission server-side.
 */
export function CrmSidebar({ showAdminLink = false, permissions }: { showAdminLink?: boolean; permissions: string[] }) {
  const pathname = usePathname();
  const visibleGroups = useMemo(() => filterNavGroups(crmNavGroups, permissions), [permissions]);

  // "/crm" itself (Command Centre) is a prefix of every other item's href,
  // so it needs an exact match only — otherwise it would show as active on
  // every CRM page.
  const isActive = (item: CrmNavItem) =>
    item.href === "/crm" ? pathname === "/crm" : pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);

  return (
    <DashboardSidebar
      title="Internal Dashboard"
      groups={visibleGroups}
      isActive={isActive}
      footer={(narrow) =>
        showAdminLink ? (
          <Link
            href="/admin"
            title={narrow ? "Admin Panel" : undefined}
            aria-label={narrow ? "Admin Panel" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md py-2 text-[12.5px] font-semibold text-accent-on-dark transition-colors duration-150 hover:bg-white/[0.06]",
              narrow ? "justify-center px-0" : "px-3"
            )}
          >
            <ShieldCheck className="h-[15px] w-[15px]" aria-hidden="true" />
            {narrow ? null : "Admin Panel"}
          </Link>
        ) : null
      }
    />
  );
}
