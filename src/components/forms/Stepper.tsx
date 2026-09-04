"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface StepperProps {
  steps: string[];
  /** 0-based index of the current step. */
  currentIndex: number;
  className?: string;
}

/** Generic animated step indicator — reusable across any multi-step flow. */
export function Stepper({ steps, currentIndex, className }: StepperProps) {
  return (
    <ol aria-label="Progress" className={cn("relative flex items-start justify-between", className)}>
      <div className="absolute left-4 right-4 top-4 -z-0 h-px bg-hairline" aria-hidden="true" />
      <div
        className="absolute left-4 top-4 -z-0 h-px bg-accent transition-all duration-300 ease-out"
        style={{
          width: steps.length > 1 ? `calc((100% - 2rem) * ${currentIndex / (steps.length - 1)})` : "0%",
        }}
        aria-hidden="true"
      />
      {steps.map((label, index) => {
        const status = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <li key={label} className="relative z-10 flex flex-1 flex-col items-center gap-2 text-center">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-200",
                status === "done" && "border-accent bg-accent text-white",
                status === "current" && "border-accent bg-surface-1 text-accent-on-light",
                status === "upcoming" && "border-hairline bg-surface-1 text-ink-muted"
              )}
              aria-current={status === "current" ? "step" : undefined}
            >
              {status === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>
            <span
              className={cn(
                "max-w-[6rem] text-xs font-medium sm:max-w-none",
                status === "upcoming" ? "text-ink-muted" : "text-ink-heading"
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
