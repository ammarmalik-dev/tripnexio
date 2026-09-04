"use client";

import { ArrowRight } from "lucide-react";
import { useQuickStart } from "./QuickStartProvider";

export function QuickStartMobileDock() {
  const { overlayOpen, setOverlayOpen } = useQuickStart();

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={overlayOpen}
      onClick={() => setOverlayOpen(true)}
      className="glass-2 flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-200 hover:border-glass-border-strong"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-ink-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        Start your application
      </span>
      <ArrowRight className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
    </button>
  );
}
