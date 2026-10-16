"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminNavGroups, filterNavGroups, type CrmNavItem } from "@/lib/crm/nav-config";
import { DashboardSidebar } from "@/components/crm/DashboardSidebar";
import { cn } from "@/lib/cn";

function matchesPath(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * The Admin sidebar looks and behaves exactly like the Internal Dashboard's
 * (both use DashboardSidebar.tsx) — same dark "liquid" surface, group headers
 * and chevrons, every group open by default and each one collapsing on its
 * own (developer request 2026-10-11), plus Expand all / Collapse all and the
 * narrow icon mode (client doc 2026-10-15, C5). Overview stays pinned at the top.
 *
 * UI-only — every item links to the same href, and every screen's own API
 * route still enforces its own permission (see nav-config.ts); this
 * component has never been the real access gate.
 */
export function AdminSidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  // P21 item 7 — only the items this user's permissions can open (admin.full sees everything); empty groups drop out.
  const visibleGroups = useMemo(() => filterNavGroups(adminNavGroups, permissions), [permissions]);
  // P25 — only the MOST specific matching href is active, so a nested item
  // (/admin/reports/management) doesn't also light up its parent (/admin/reports).
  const activeHref =
    visibleGroups
      .flatMap((group) => group.items.map((item) => item.href))
      .filter((href) => matchesPath(pathname, href))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <DashboardSidebar
      title="Admin"
      groups={visibleGroups}
      isActive={(item: CrmNavItem) => item.href === activeHref}
      footer={(narrow) => (
        <Link
          href="/crm"
          title={narrow ? "Back to Internal Dashboard" : undefined}
          aria-label={narrow ? "Back to Internal Dashboard" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md py-2 text-[12.5px] font-semibold text-accent-on-dark transition-colors duration-150 hover:bg-white/[0.06]",
            narrow ? "justify-center px-0" : "px-3"
          )}
        >
          <ArrowLeft className="h-[15px] w-[15px]" aria-hidden="true" />
          {narrow ? null : "Back to Internal Dashboard"}
        </Link>
      )}
    />
  );
}
