"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronDown, type LucideIcon } from "lucide-react";
import { adminNavGroups, type CrmNavItem } from "@/lib/crm/nav-config";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

function isItemActive(pathname: string | null, href: string) {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * Step 46 (Admin FINAL handover §20, "Keep Sidebar Short — use grouped
 * dropdowns/accordions"). A real single-open accordion, not just static
 * group headers (that's what crmNavGroups/CrmSidebar.tsx already do, for a
 * much smaller ~9-item list) — with ~25 Admin items, showing every group
 * expanded at once would defeat the entire point of this step. Opening a
 * new group collapses whichever one was open; the group containing the
 * current page starts open so landing on a page never hides its own nav
 * entry.
 *
 * UI-only — every item still links to the exact same href as before this
 * step, and every screen's own API route still enforces its own
 * permission independently (see nav-config.ts's own doc comment); this
 * component has never been the real access gate.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const activeGroupLabel = adminNavGroups.find((group) => group.items.some((item) => isItemActive(pathname, item.href)))?.label ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroupLabel);

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-surface-dark to-surface-dark-2 p-4 pt-5">
      <div className="px-2 pb-5">
        <Logo variant="onDark" />
        <p className="mt-1.5 text-[10.5px] font-semibold tracking-wide text-ink-on-dark-muted uppercase">Admin</p>
      </div>
      <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
        {adminNavGroups.map((group, groupIndex) => {
          if (group.label === null) {
            return (
              <div key={`group-${groupIndex}`} className="flex flex-col gap-1 pb-2">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} isActive={isItemActive(pathname, item.href)} />
                ))}
              </div>
            );
          }

          const isOpen = openGroup === group.label;
          const isActiveGroup = activeGroupLabel === group.label;

          return (
            <div key={group.label} className="flex flex-col">
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? null : group.label)}
                aria-expanded={isOpen}
                className={cn(
                  "group-head flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-[11px] font-bold tracking-wide uppercase transition-colors duration-150",
                  isActiveGroup ? "text-accent-on-dark" : "text-ink-on-dark-muted hover:text-ink-on-dark-primary"
                )}
              >
                {group.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? "rotate-180" : "")} aria-hidden="true" />
              </button>
              <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="flex flex-col gap-1 overflow-hidden pb-2">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} isActive={isItemActive(pathname, item.href)} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
      <Link
        href="/crm/leads"
        className="mt-3 flex items-center gap-2.5 rounded-md border border-hairline-on-dark px-3 py-2 text-sm font-medium text-ink-on-dark-secondary transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink-on-dark-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Internal Dashboard
      </Link>
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
