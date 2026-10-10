"use client";

import { useEffect, useState } from "react";
import { BadgeIndianRupee, CalendarClock, FileText, ListChecks, RotateCcw, ScrollText, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceConfigTab } from "@/lib/admin/service-configuration";
import type { ServiceType } from "../../generated/prisma/enums";

interface Summary {
  pricingRules: number;
  documents: number;
  documentsOffMaster: number;
  statuses: number;
  terms: number;
  timelineValues: number;
  countryTimelines: number;
  refundConfigured: boolean;
}

interface Card {
  tab: ServiceConfigTab;
  label: string;
  value: string;
  note: string;
  attention: boolean;
  Icon: LucideIcon;
}

function buildCards(summary: Summary): Card[] {
  return [
    {
      tab: "timelines",
      label: "TAT / Timelines",
      value: summary.timelineValues > 0 ? `${summary.timelineValues} set` : "Not set",
      note: summary.countryTimelines > 0 ? `${summary.countryTimelines} country timeline${summary.countryTimelines === 1 ? "" : "s"}` : "Service-wide values",
      attention: summary.timelineValues === 0,
      Icon: CalendarClock,
    },
    {
      tab: "documents",
      label: "Documents",
      value: String(summary.documents),
      note: summary.documentsOffMaster > 0 ? `${summary.documentsOffMaster} not linked to Document Master` : "All from Document Master",
      attention: summary.documents === 0 || summary.documentsOffMaster > 0,
      Icon: FileText,
    },
    {
      tab: "pricing",
      label: "Pricing rules",
      value: String(summary.pricingRules),
      note: summary.pricingRules === 0 ? "No active price" : "Active rules",
      attention: summary.pricingRules === 0,
      Icon: BadgeIndianRupee,
    },
    {
      tab: "refunds",
      label: "Refund policy",
      value: summary.refundConfigured ? "Configured" : "Default",
      note: summary.refundConfigured ? "Service rules saved" : "Using the default rules",
      attention: !summary.refundConfigured,
      Icon: RotateCcw,
    },
    {
      tab: "statuses",
      label: "Statuses",
      value: String(summary.statuses),
      note: "Internal + customer labels",
      attention: summary.statuses === 0,
      Icon: ListChecks,
    },
    {
      tab: "terms",
      label: "Terms",
      value: String(summary.terms),
      note: summary.terms === 0 ? "No active terms" : "Active versions",
      attention: summary.terms === 0,
      Icon: ScrollText,
    },
  ];
}

/**
 * Client testing 2026-10-09 (F7) — summary cards at the top of the Service
 * Configuration hub: what is configured for the chosen service at a glance;
 * a card opens its section, and an amber one needs attention.
 */
export function ServiceConfigSummaryCards({
  service,
  tabs,
  activeTab,
  onOpen,
}: {
  service: ServiceType;
  tabs: ServiceConfigTab[];
  activeTab: ServiceConfigTab;
  onOpen: (tab: ServiceConfigTab) => void;
}) {
  const [result, setResult] = useState<{ service: ServiceType; summary: Summary | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const summary = await getJson<Summary>(`/api/admin/service-configuration/summary?service=${service}`);
        if (!cancelled) setResult({ service, summary });
      } catch {
        if (!cancelled) setResult({ service, summary: null });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [service]);

  if (!result || result.service !== service) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  // The cards are a convenience; the sections below still work if the summary can't be read.
  if (!result.summary) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {buildCards(result.summary)
        .filter((card) => tabs.includes(card.tab))
        .map(({ tab, label, value, note, attention, Icon }) => (
          <button
            key={tab}
            type="button"
            onClick={() => onOpen(tab)}
            aria-pressed={activeTab === tab}
            className={cn(
              "flex flex-col gap-1 rounded-xl border bg-surface-1 px-3.5 py-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(24_42_77/0.08)] motion-reduce:hover:translate-y-0",
              activeTab === tab ? "border-accent ring-2 ring-accent/20" : "border-hairline"
            )}
          >
            <span className="flex items-center gap-2 text-xs font-medium text-ink-tertiary">
              <Icon className={cn("h-4 w-4", attention ? "text-warning" : "text-accent-on-light")} aria-hidden="true" />
              {label}
            </span>
            <span className="text-lg leading-tight font-bold text-ink-heading">{value}</span>
            <span className={cn("text-xs", attention ? "text-warning" : "text-ink-tertiary")}>{note}</span>
          </button>
        ))}
    </div>
  );
}
