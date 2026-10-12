import { flagImageSrc } from "@/lib/countries/flag";
import { cn } from "@/lib/cn";

/**
 * A country flag from a flag string (emoji or image URL). Emoji flags don't
 * render on Windows (they show as "AE"), so a flag emoji is drawn with the
 * self-hosted SVG from /public/flags instead; anything else is shown as text.
 */
export function FlagIcon({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return null;
  const src = flagImageSrc(value);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- tiny flag icon, may be an Admin-set URL on any host
    return <img src={src} alt="" aria-hidden="true" className={cn("inline-block h-3.5 w-5 shrink-0 rounded-[2px] object-cover", className)} />;
  }
  return (
    <span aria-hidden="true" className={cn("leading-none", className)}>
      {value}
    </span>
  );
}
