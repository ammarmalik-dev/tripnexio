import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-pulse rounded-md bg-ink-primary/[0.08] motion-reduce:animate-none",
        className
      )}
    />
  );
}
