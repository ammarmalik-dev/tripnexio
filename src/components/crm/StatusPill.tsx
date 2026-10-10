import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "error" | "accent" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/10 text-error",
  accent: "bg-accent/10 text-accent-on-light",
  neutral: "bg-ink-primary/[0.06] text-ink-secondary",
};

/** Colour from the words in the label, so every Admin-defined status gets a sensible colour. */
function toneFor(label: string): Tone {
  const text = label.toLowerCase();
  if (/(cancel|reject|fail|refund|unable|expired|not approved)/.test(text)) return "error";
  if (/(complete|approved|success|confirmed|delivered|issued|validated|paid|closed won)/.test(text)) return "success";
  if (/(pending|required|missing|waiting|awaiting|on hold|draft|new)/.test(text)) return "warning";
  if (/(process|progress|ticket|pnr|review|applied|submitted|sent|quoted|qualified|contacted)/.test(text)) return "accent";
  return "neutral";
}

/**
 * Client testing 2026-10-09 (E13) — the rounded status pill of the client's
 * table sample, used for customer / internal / payment statuses in the CRM lists.
 */
export function StatusPill({ label, className }: { label: string | null | undefined; className?: string }) {
  if (!label) return <span className="text-xs text-ink-tertiary">—</span>;
  return (
    <span className={cn("inline-flex max-w-[11rem] items-center rounded-lg px-2.5 py-1 text-center text-xs leading-tight font-medium", TONE_CLASSES[toneFor(label)], className)}>
      {label}
    </span>
  );
}
