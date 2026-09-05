import Link from "next/link";
import { headerActions } from "@/lib/nav-config";

/** Guests can browse and start requests without an account (see CLAUDE.md Auth section). */
export function GuestContinueLink() {
  return (
    <Link
      href={headerActions.getStarted.href}
      className="text-center text-sm font-medium text-ink-secondary underline decoration-hairline underline-offset-4 transition-colors duration-200 hover:text-ink-accent"
    >
      Continue as Guest
    </Link>
  );
}
