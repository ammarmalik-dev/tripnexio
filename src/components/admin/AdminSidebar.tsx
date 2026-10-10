"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, type LucideIcon } from "lucide-react";
import { adminNavGroups, filterNavGroups, type CrmNavItem } from "@/lib/crm/nav-config";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

function matchesPath(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * The Admin sidebar looks and behaves exactly like the Internal Dashboard's
 * (CrmSidebar.tsx) — same dark "liquid" surface, same group headers and
 * chevrons, every group open by default and each one collapsing on its own
 * (developer request 2026-10-11, replacing the white single-open accordion
 * of client testing 2026-10-09 F8). Overview stays pinned at the top.
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <aside className="crm-sidebar-liquid flex w-64 shrink-0 flex-col p-4 pt-5">
      <div className="px-2 pb-5">
        <Logo variant="onDark" />
        <p className="mt-1.5 text-[10.5px] font-semibold tracking-wide text-ink-on-dark-muted uppercase">Admin</p>
      </div>

      <nav aria-label="Admin" className="flex flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
        {visibleGroups.map((group, groupIndex) => {
          if (!group.label) {
            return (
              <div key={`group-${groupIndex}`} className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} isActive={item.href === activeHref} />
                ))}
              </div>
            );
          }

          const isOpen = !collapsedGroups.has(group.label);

          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                aria-expanded={isOpen}
                className="group-head flex w-full items-center justify-between rounded-md px-3 pb-1.5 text-left transition-colors duration-150"
              >
                <span className="text-[10.5px] font-bold tracking-wider text-ink-on-dark-muted uppercase">{group.label}</span>
                <ChevronDown
                  className={cn("h-3.5 w-3.5 text-ink-on-dark-muted transition-transform duration-200", isOpen ? "rotate-0" : "-rotate-90")}
                  aria-hidden="true"
                />
              </button>
              <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} isActive={item.href === activeHref} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-3 flex flex-col gap-2.5 border-t border-hairline-on-dark pt-3.5">
        <Link
          href="/crm"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[12.5px] font-semibold text-accent-on-dark transition-colors duration-150 hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-[15px] w-[15px]" aria-hidden="true" />
          Back to Internal Dashboard
        </Link>
      </div>
    </aside>
  );
}

function NavLink({ item, isActive }: { item: CrmNavItem; isActive: boolean }) {
  const Icon: LucideIcon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "nav-item flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150",
        isActive ? "bg-[image:var(--gradient-accent)] text-white shadow-[0_4px_14px_rgb(62_111_219/0.35)]" : "text-ink-on-dark-secondary hover:bg-white/[0.07] hover:text-ink-on-dark-primary"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}
