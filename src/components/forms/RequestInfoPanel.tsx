import { Info } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { utilityLinks } from "@/lib/nav-config";

interface RequestInfoPanelProps {
  title: string;
  description: string;
  cta?: { label: string; href: string };
}

/**
 * Shared "we can't proceed, here's why and what to do instead" state for
 * any request flow — distinct from RequestSuccessPanel (which always
 * implies a lead was created). Used by MultiStepRequestFlow when a
 * service's onSubmit throws RequestIneligibleOutcome (e.g. Visa
 * Extension's no-matching-TripNexio-visa redirect).
 */
export function RequestInfoPanel({ title, description, cta }: RequestInfoPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-hairline bg-surface-1 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
        <Info className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-ink-heading">{title}</p>
        <p className="max-w-sm text-sm text-ink-secondary">{description}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {cta ? (
          <ButtonLink href={cta.href} variant="primary" size="md">
            {cta.label}
          </ButtonLink>
        ) : null}
        <ButtonLink href={utilityLinks.trackStatus.href} variant="ghost" size="md">
          Track Status
        </ButtonLink>
      </div>
    </div>
  );
}
