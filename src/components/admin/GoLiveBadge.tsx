import { cn } from "@/lib/cn";

/** P26 — small go-live flag badge, shared by Admin → Integrations and the Admin AI Command Center. */
export function GoLiveBadge({ ready, className }: { ready: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ready ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
        className
      )}
    >
      {ready ? "Go-live ready" : "Not go-live ready"}
    </span>
  );
}
