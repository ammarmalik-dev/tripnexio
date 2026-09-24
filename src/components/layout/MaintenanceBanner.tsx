"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Step 45 (Admin FINAL handover §19) — client confirmed: a dismissible
 * banner, not a full site lockout. Non-blocking by design — the site keeps
 * working normally; this is purely informational. Dismiss is per-page-view
 * only (plain React state, not persisted) — simple on purpose, since staff
 * turn this off in Admin once maintenance is over rather than relying on
 * every visitor's browser to remember a dismissal.
 */
export function MaintenanceBanner({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
      <span>{message}</span>
      <button type="button" onClick={() => setDismissed(true)} className="shrink-0 rounded p-0.5 hover:bg-warning/20" aria-label="Dismiss">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
