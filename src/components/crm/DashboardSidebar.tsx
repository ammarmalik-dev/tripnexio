"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import type { CrmNavGroup, CrmNavItem } from "@/lib/crm/nav-config";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

/**
 * The dark "liquid" sidebar shared by the Internal Dashboard and Admin. Every group is open by default
 * and collapses on its own; client doc 2026-10-15 (C5) adds Expand all / Collapse all and a narrow
 * icon-only mode (hover an icon for its name), so every section stays easy to reach.
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [narrow, setNarrow] = useState(false);
  const labelled = groups.flatMap((group) => (group.label ? [group.label] : []));
  const allOpen = collapsedGroups.size === 0;

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const controlClass =
    "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-ink-on-dark-muted transition-colors duration-150 hover:bg-white/[0.07] hover:text-ink-on-dark-primary";

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

      {!narrow && labelled.length > 1 ? (
        <div className="flex items-center gap-1 px-1 pb-3">
          <button type="button" className={controlClass} onClick={() => setCollapsedGroups(new Set())} disabled={allOpen} aria-label="Expand all sections">
            <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            Expand all
          </button>
          <button
            type="button"
            className={controlClass}
            onClick={() => setCollapsedGroups(new Set(labelled))}
            disabled={collapsedGroups.size === labelled.length}
            aria-label="Collapse all sections"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden="true" />
            Collapse all
          </button>
        </div>
      ) : null}

      <nav aria-label={title} className={cn("flex flex-1 flex-col overflow-y-auto pr-0.5", narrow ? "gap-1" : "gap-4")}>
        {groups.map((group, groupIndex) => {
          const items = group.items.map((item) => <NavLink key={item.href} item={item} active={isActive(item)} narrow={narrow} />);
          // Narrow mode lists every icon (no group headers to open).
          if (!group.label || narrow) {
            return (
              <div key={group.label ?? `group-${groupIndex}`} className={cn("flex flex-col gap-1", narrow && groupIndex > 0 && "border-t border-hairline-on-dark pt-1")}>
                {items}
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
                <div className="flex flex-col gap-1 overflow-hidden">{items}</div>
              </div>
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
