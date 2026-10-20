import { Info } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { utilityLinks } from "@/lib/nav-config";

interface RequestInfoPanelProps {
  title: string;
  description: string;
  cta?: { label: string; href: string };
  /** A second, equally weighted choice (e.g. inside vs. outside the UAE). */
  secondaryCta?: { label: string; href: string };
}

/**
 * Shared "we can't proceed, here's why and what to do instead" state for
 * any request flow — distinct from RequestSuccessPanel (which always
 * implies a lead was created). Used by MultiStepRequestFlow when a
 * service's onSubmit throws RequestIneligibleOutcome (e.g. Visa
 * Extension's no-matching-TripNexio-visa redirect).
 */
export function RequestInfoPanel({ title, description, cta, secondaryCta }: RequestInfoPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-hairline bg-surface-1 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent-on-light">
        <Info className="h-7 w-7" aria-hidden="true" />
      </div>
      {/* Client doc 2026-10-20 (D4) — the explanation is centred under the heading, not pinned to its left edge. */}
      <div className="flex max-w-xl flex-col items-center gap-1">
        <p className="text-lg font-semibold text-balance text-ink-heading">{title}</p>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-balance text-ink-secondary">{description}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {cta ? (
          <ButtonLink href={cta.href} variant="primary" size="md">
            {cta.label}
          </ButtonLink>
        ) : null}
        {secondaryCta ? (
          <ButtonLink href={secondaryCta.href} variant="primary" size="md">
            {secondaryCta.label}
          </ButtonLink>
        ) : null}
        <ButtonLink href={utilityLinks.trackStatus.href} variant="ghost" size="md">
          Track Status
        </ButtonLink>
      </div>
    </div>
  );
}
