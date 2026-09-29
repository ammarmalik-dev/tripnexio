"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ServiceFaqItem {
  id: string;
  question: string;
  answer: string;
}

const INITIAL_COUNT = 8;

/**
 * P19 — a service page's FAQ accordion: two columns on desktop, one on
 * mobile, the first few shown with a "View all" toggle. Native
 * <details>/<summary>, so it's keyboard- and screen-reader-friendly with no
 * extra ARIA wiring.
 */
export function ServiceFaqAccordion({ items }: { items: ServiceFaqItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, INITIAL_COUNT);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visible.map((faq) => (
          <details key={faq.id} className="group h-fit rounded-xl border border-hairline bg-surface-1 px-5 py-4 open:border-glass-border-strong">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-ink-primary marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
              <span>{faq.question}</span>
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-tertiary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{faq.answer}</p>
          </details>
        ))}
      </div>
      {items.length > INITIAL_COUNT ? (
        <div className="flex justify-center">
          <Button type="button" variant="glass" size="sm" onClick={() => setShowAll((current) => !current)} aria-expanded={showAll}>
            {showAll ? "Show fewer questions" : `View all ${items.length} questions`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
