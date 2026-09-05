import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { headerActions, utilityLinks } from "@/lib/nav-config";

interface AuthSuccessNoticeProps {
  title: string;
  description: string;
}

/** Shown after login/register mock-submits — no real session exists yet (M2), so this is honest about being a preview rather than faking a signed-in state. */
export function AuthSuccessNotice({ title, description }: AuthSuccessNoticeProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold text-ink-heading">{title}</p>
        <p className="max-w-sm text-sm text-ink-secondary">{description}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href={headerActions.getStarted.href} variant="primary" size="md">
          Browse Services
        </ButtonLink>
        <ButtonLink href={utilityLinks.trackStatus.href} variant="ghost" size="md">
          Track Status
        </ButtonLink>
      </div>
    </div>
  );
}
