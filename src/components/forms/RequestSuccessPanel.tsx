import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { utilityLinks, headerActions } from "@/lib/nav-config";

interface RequestSuccessPanelProps {
  title: string;
  description: string;
  referenceId: string;
  /** Primary next step (e.g. pay now); shown before the generic Track Status button. */
  cta?: { label: string; href: string };
}

/** Shared post-submit success state for any request flow. */
export function RequestSuccessPanel({ title, description, referenceId, cta }: RequestSuccessPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-hairline bg-surface-1 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-ink-heading">{title}</p>
        <p className="max-w-sm text-sm text-ink-secondary">{description}</p>
      </div>
      <p className="rounded-md bg-surface-2 px-4 py-2 text-sm font-medium text-ink-primary">
        Reference ID: <span className="text-ink-accent">{referenceId}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {cta ? (
          <ButtonLink href={cta.href} variant="primary" size="md">
            {cta.label}
          </ButtonLink>
        ) : null}
        <ButtonLink href={utilityLinks.trackStatus.href} variant={cta ? "ghost" : "primary"} size="md">
          Track Status
        </ButtonLink>
        <ButtonLink href={headerActions.getStarted.href} variant="ghost" size="md">
          Browse Services
        </ButtonLink>
      </div>
    </div>
  );
}
