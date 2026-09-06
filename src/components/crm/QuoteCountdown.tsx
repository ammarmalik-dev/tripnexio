import { cn } from "@/lib/cn";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Pure/presentational — the ticking `now` value is owned by the parent so every card in a list re-renders off one shared timer. */
export function QuoteCountdown({ validityExpiresAt, now }: { validityExpiresAt: string; now: number }) {
  const remaining = new Date(validityExpiresAt).getTime() - now;
  if (remaining <= 0) {
    return <span className="text-xs font-medium text-error">Expired</span>;
  }
  const urgent = remaining < 5 * 60 * 1000;
  return (
    <span className={cn("text-xs font-medium", urgent ? "text-error" : "text-ink-tertiary")}>
      Expires in {formatRemaining(remaining)}
    </span>
  );
}
