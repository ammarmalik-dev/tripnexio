import { countryFlag } from "@/lib/countries/flag";
import { cn } from "@/lib/cn";

/** A country's flag (emoji, or the Admin-set image override). Shared by the Master Data lists. */
export function FlagBadge({ code, flagOverride, className }: { code: string; flagOverride?: string | null; className?: string }) {
  const flag = countryFlag({ code, flagOverride });
  if (flag.kind === "image") {
    // Admin-supplied arbitrary URL (any host), so a plain <img> rather than next/image's domain allow-list.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={flag.value} alt="" aria-hidden="true" className={cn("inline-block h-5 w-7 rounded-sm object-cover", className)} />;
  }
  return (
    <span aria-hidden="true" className={cn("text-xl leading-none", className)}>
      {flag.value}
    </span>
  );
}
