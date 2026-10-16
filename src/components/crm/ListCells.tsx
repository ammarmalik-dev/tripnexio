import { Zap } from "lucide-react";
import { FlagIcon } from "@/components/ui/FlagIcon";

/**
 * Client doc 2026-10-15 (C4) — "Normal" / "Urgent" written under the booking / lead ID in every CRM
 * list (New Visa's urgent tier reads "Express"). Renders nothing for services without a processing choice.
 */
export function ProcessingTag({ label }: { label: string | null | undefined }) {
  if (!label) return null;
  if (label === "Normal") return <span className="block text-xs font-medium text-ink-secondary">Normal</span>;
  return (
    <span className="mt-0.5 flex">
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error" title={`${label} processing`}>
        <Zap className="h-3 w-3" aria-hidden="true" />
        {label}
      </span>
    </span>
  );
}

/** Client doc 2026-10-15 (C3) — the country as its flag and short code (full name on hover). */
export function CountryCell({ name, code, flag }: { name: string | null; code?: string | null; flag: string | null }) {
  if (!name) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1.5" title={name}>
      <FlagIcon value={flag} />
      <span className="font-medium">{code ? code.toUpperCase() : name}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}
