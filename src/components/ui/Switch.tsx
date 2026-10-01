"use client";

import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — required because a switch has no visible text of its own. */
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Accessible on/off toggle (role="switch"). Keyboard: Space/Enter via the native button. */
export function Switch({ checked, onChange, label, disabled, size = "md", className }: SwitchProps) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const thumb = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const travel = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border border-transparent p-px transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
        track,
        checked ? "bg-accent" : "bg-ink-primary/15",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none",
          thumb,
          checked ? travel : "translate-x-0"
        )}
      />
    </button>
  );
}
