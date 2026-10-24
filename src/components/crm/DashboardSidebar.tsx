"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import type { CrmNavGroup, CrmNavItem } from "@/lib/crm/nav-config";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

/**
 * The dark "liquid" sidebar shared by the Internal Dashboard and Admin. Client doc 2026-10-20 (L2) removed the
 * per-group and Expand / Collapse all buttons, keeping the sidebar toggle (a narrow icon-only mode — hover an
 * icon for its name); client 2026-10-25 — each group still opens / closes by clicking its own heading.
 *
 * UI-only — every item links to the same href and every screen's own API route enforces its permission.
 */
export function DashboardSidebar({
  title,
  groups,
  isActive,
  footer,
}: {
  title: string;
  groups: CrmNavGroup[];
  isActive: (item: CrmNavItem) => boolean;
  /** Rendered at the bottom; receives whether the sidebar is narrow. */
  footer?: (narrow: boolean) => ReactNode;
}) {
  const [narrow, setNarrow] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const toggleGroup = (label: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <aside className={cn("crm-sidebar-liquid flex shrink-0 flex-col pt-5 transition-[width] duration-300", narrow ? "w-[4.5rem] px-2 pb-4" : "w-64 p-4")}>
      <div className={cn("flex items-start justify-between gap-2 pb-4", narrow ? "flex-col items-center px-0" : "px-2")}>
        {narrow ? null : (
          <div>
            <Logo variant="onDark" />
            <p className="mt-1.5 text-[10.5px] font-semibold tracking-wide text-ink-on-dark-muted uppercase">{title}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setNarrow((current) => !current)}
          aria-label={narrow ? "Expand sidebar" : "Collapse sidebar"}
          title={narrow ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-on-dark-muted transition-colors duration-150 hover:bg-white/[0.07] hover:text-ink-on-dark-primary"
        >
          {narrow ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <nav aria-label={title} className={cn("flex flex-1 flex-col overflow-y-auto pr-0.5", narrow ? "gap-1" : "gap-4")}>
        {groups.map((group, groupIndex) => {
          const items = group.items.map((item) => <NavLink key={item.href} item={item} active={isActive(item)} narrow={narrow} />);
          // Narrow mode lists every icon (no group headers).
          if (!group.label || narrow) {
            return (
              <div key={group.label ?? `group-${groupIndex}`} className={cn("flex flex-col gap-1", narrow && groupIndex > 0 && "border-t border-hairline-on-dark pt-1")}>
                {items}
              </div>
            );
          }
          const open = !closed.has(group.label);
          const listId = `sidebar-group-${groupIndex}`;
          return (
            <div key={group.label} role="group" aria-label={group.label}>
              <button
                type="button"
                onClick={() => toggleGroup(group.label as string)}
                aria-expanded={open}
                aria-controls={listId}
                className="flex w-full items-center justify-between rounded-md px-3 pb-1.5 text-[10.5px] font-bold tracking-wider text-ink-on-dark-muted uppercase transition-colors duration-150 hover:text-ink-on-dark-primary"
              >
                {group.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open ? "" : "-rotate-90")} aria-hidden="true" />
              </button>
              {open ? (
                <div id={listId} className="flex flex-col gap-1">
                  {items}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {footer ? <div className="mt-3 flex flex-col gap-2.5 border-t border-hairline-on-dark pt-3.5">{footer(narrow)}</div> : null}
    </aside>
  );
}

function NavLink({ item, active, narrow }: { item: CrmNavItem; active: boolean; narrow: boolean }) {
  const Icon: LucideIcon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={narrow ? item.label : undefined}
      aria-label={narrow ? item.label : undefined}
      className={cn(
        "nav-item flex items-center gap-2.5 rounded-lg py-2 text-[13.5px] font-medium transition-colors duration-150",
        narrow ? "justify-center px-0" : "px-3",
        active ? "bg-[image:var(--gradient-accent)] text-white shadow-[0_4px_14px_rgb(62_111_219/0.35)]" : "text-ink-on-dark-secondary hover:bg-white/[0.07] hover:text-ink-on-dark-primary"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {narrow ? null : item.label}
    </Link>
  );
}
