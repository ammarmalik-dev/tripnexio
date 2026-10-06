"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Client corrections 2026-10-05 §18 — one detail-page language for Lead,
 * Quotation and Booking: a compact glass header (identity + current status +
 * POC + primary actions together), a key-summary strip, then tabs so the
 * record scans without a long scroll.
 */

export interface RecordFact {
  label: string;
  value: ReactNode;
}

export function RecordHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  facts,
  status,
  controls,
  actions,
}: {
  backHref: string;
  backLabel: string;
  /** e.g. "New Visa · 10626VI001" */
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The key summary — short label/value pairs shown under the title. */
  facts: RecordFact[];
  /** The ONE status-update area (internal + customer-facing status). */
  status?: ReactNode;
  /** POC / temperature and similar per-record controls. */
  controls?: ReactNode;
  /** Primary actions (buttons/links). */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-secondary transition-colors duration-150 hover:text-ink-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="glass-liquid flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tracking-wide text-ink-tertiary uppercase">{eyebrow}</div>
            <h1 className="text-xl font-semibold text-ink-heading sm:text-2xl">{title}</h1>
            {subtitle ? <div className="text-xs text-ink-tertiary">{subtitle}</div> : null}
          </div>
          {status ? (
            <div className="rounded-xl border border-glass-border bg-surface-1/80 px-3 py-2.5 lg:max-w-[520px]">
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-tertiary uppercase">Status update</p>
              {status}
            </div>
          ) : null}
        </div>

        {facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hairline pt-3 sm:grid-cols-3 lg:grid-cols-6">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-[11px] font-medium tracking-wide text-ink-tertiary uppercase">{fact.label}</dt>
                <dd className="mt-0.5 text-sm font-medium break-words text-ink-primary">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {controls || actions ? (
          <div className="flex flex-col gap-3 border-t border-hairline pt-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">{controls}</div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export interface RecordTab {
  id: string;
  label: string;
  /** Optional count badge (documents, passengers…). */
  count?: number;
  content: ReactNode;
}

function initialTab(tabs: RecordTab[]): string {
  if (typeof window !== "undefined") {
    const fromHash = window.location.hash.replace(/^#tab-/, "");
    if (tabs.some((tab) => tab.id === fromHash)) return fromHash;
  }
  return tabs[0]?.id ?? "";
}

/**
 * Accessible tabs (arrow keys / Home / End). Panels stay mounted (hidden)
 * so a half-filled form on one tab survives switching to another; the
 * active tab is mirrored in the URL hash so a reload lands on it again.
 */
export function RecordTabs({ tabs, label }: { tabs: RecordTab[]; label: string }) {
  const [active, setActive] = useState(() => initialTab(tabs));
  const activeId = tabs.some((tab) => tab.id === active) ? active : tabs[0]?.id;

  const select = (id: string, focus = false) => {
    setActive(id);
    try {
      window.history.replaceState(null, "", `#tab-${id}`);
    } catch {
      // Hash mirroring is a convenience only.
    }
    if (focus) document.getElementById(`record-tab-${id}`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      event.preventDefault();
      select(tabs[next].id, true);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-1 sticky top-2 z-10 overflow-x-auto rounded-xl p-1 no-scrollbar">
        <div role="tablist" aria-label={label} className="flex w-max min-w-full gap-1">
          {tabs.map((tab, index) => {
            const selected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                id={`record-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`record-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
                  selected ? "bg-surface-1 text-ink-heading shadow-[var(--shadow-glass-1)] ring-1 ring-glass-border" : "text-ink-secondary hover:bg-surface-1/60 hover:text-ink-primary"
                )}
              >
                {tab.label}
                {typeof tab.count === "number" ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold",
                      selected ? "bg-accent/12 text-ink-accent" : "bg-ink-primary/6 text-ink-tertiary"
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`record-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`record-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

/** A glass section card inside a tab. */
export function RecordSection({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass-2 rounded-xl p-4 sm:p-5", className)}>
      {title || action ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-sm font-semibold text-ink-heading">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
