"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { cn } from "@/lib/cn";

export interface FaqExplorerItem {
  id: string;
  question: string;
  answer: string;
  /** "GENERAL" or a service type. */
  topic: string;
  topicLabel: string;
  countryCode: string | null;
  countryName: string | null;
  keywords: string[];
}

/**
 * Client 2026-10-25 — every published FAQ on /faq (general, every service, every New Visa country), searchable by
 * text and narrowed by service or country. The starting filters come from the URL (?service=…&country=…&q=…).
 */
export function FaqExplorer({
  items,
  topics,
  countries,
  initial,
}: {
  items: FaqExplorerItem[];
  topics: { value: string; label: string }[];
  countries: { code: string; name: string }[];
  initial: { q: string; topic: string; country: string };
}) {
  const [query, setQuery] = useState(initial.q);
  const [topic, setTopic] = useState(initial.topic);
  const [country, setCountry] = useState(initial.country);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (topic && item.topic !== topic) return false;
      if (country && item.countryCode !== country) return false;
      if (!term) return true;
      return [item.question, item.answer, item.topicLabel, item.countryName ?? "", ...item.keywords].some((value) => value.toLowerCase().includes(term));
    });
  }, [items, query, topic, country]);

  const groups = useMemo(() => {
    const map = new Map<string, FaqExplorerItem[]>();
    for (const item of filtered) {
      const key = item.countryName ? `${item.topicLabel} — ${item.countryName}` : item.topicLabel;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [filtered]);

  const hasFilters = query.trim() !== "" || topic !== "" || country !== "";
  const clear = () => {
    setQuery("");
    setTopic("");
    setCountry("");
  };
  const selectClass = cn(fieldControlClass, fieldBorderClass(false), "h-11 sm:w-52");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface-1/80 p-3 backdrop-blur sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search FAQs"
            placeholder="Search a question, service or country"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-11 pl-9")}
          />
        </div>
        <select aria-label="Filter by service" value={topic} onChange={(event) => setTopic(event.target.value)} className={selectClass}>
          <option value="">All services</option>
          {topics.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {countries.length > 0 ? (
          <select aria-label="Filter by country" value={country} onChange={(event) => setCountry(event.target.value)} className={selectClass}>
            <option value="">All countries</option>
            {countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <p className="-mt-5 text-xs font-medium text-ink-tertiary" aria-live="polite">
        {filtered.length} question{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          title="No questions match"
          description="Try another word, or clear the filters."
          action={
            hasFilters ? (
              <Button type="button" size="sm" variant="ghost" onClick={clear}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        groups.map(([heading, rows]) => (
          <section key={heading} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-ink-heading">{heading}</h2>
            {rows.map((faq) => (
              <details key={faq.id} className="group rounded-xl border border-hairline bg-surface-1 px-5 py-4 open:border-glass-border-strong">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-ink-primary marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
                  <span>{faq.question}</span>
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-tertiary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{faq.answer}</p>
              </details>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
