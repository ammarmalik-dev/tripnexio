"use client";

import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { buttonBaseClass, buttonSizeClass } from "@/components/ui/Button";

/**
 * Step 48 — mirrors src/components/auth/GoogleButton.tsx (the customer-
 * facing placeholder) verbatim: no GOOGLE_CLIENT_ID/SECRET exist yet for
 * either flow, so there's nothing to gate with isPlaceholder() — this is
 * a clearly-labeled non-functional stub, not a fake OAuth redirect, same
 * as that component's own convention.
 */
export function StaffGoogleButton() {
  return (
    <button
      type="button"
      onClick={() => toast("Google sign-in for staff isn't connected yet — coming in a future update.")}
      className={cn(
        buttonBaseClass,
        buttonSizeClass.md,
        "w-full border border-hairline bg-surface-1 text-ink-primary hover:bg-ink-primary/[0.03] focus-visible:outline-accent"
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.41 3.62v3h3.9c2.28-2.1 3.56-5.2 3.56-8.81Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.9-3c-1.08.73-2.46 1.16-4.05 1.16-3.12 0-5.76-2.1-6.7-4.93h-4v3.1C3.28 21.3 7.31 24 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.3 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.39-2.31v-3.1h-4A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.3 5.41l4-3.1Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.28 2.7 1.3 6.59l4 3.1c.94-2.83 3.58-4.92 6.7-4.92Z"
        />
      </svg>
      Continue with Google
    </button>
  );
}
