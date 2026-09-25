"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { crmNavGroups, type CrmNavItem } from "@/lib/crm/nav-config";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

export function CrmSidebar({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const pathname = usePathname();
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
    <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-surface-dark to-surface-dark-2 p-4 pt-5">
      <div className="px-2 pb-5">
        <Logo variant="onDark" />
        <p className="mt-1.5 text-[10.5px] font-semibold tracking-wide text-ink-on-dark-muted uppercase">Internal Dashboard</p>
      </div>

      <nav aria-label="Internal Dashboard" className="flex flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
        {crmNavGroups.map((group, groupIndex) => {
          if (!group.label) {
            return (
              <div key={`group-${groupIndex}`} className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
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
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-3 flex flex-col gap-2.5 border-t border-hairline-on-dark pt-3.5">
        {showAdminLink ? (
          <Link
            href="/admin"
            className="flex items-center justify-between gap-2.5 rounded-md px-3 py-2 text-[12.5px] font-semibold text-accent-on-dark transition-colors duration-150 hover:bg-white/[0.06]"
          >
            <span className="flex items-center gap-2.5">
              <ShieldCheck className="h-[15px] w-[15px]" aria-hidden="true" />
              Admin Panel
            </span>
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

function NavLink({ item, pathname }: { item: CrmNavItem; pathname: string | null }) {
  // "/crm" itself (Command Centre) is a prefix of every other item's href,
  // so it needs an exact match only — otherwise it would show as active on
  // every CRM page.
  const isActive = item.href === "/crm" ? pathname === "/crm" : pathname === item.href || pathname?.startsWith(`${item.href}/`);
  const Icon = item.icon;

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
