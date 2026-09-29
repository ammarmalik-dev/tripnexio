"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { COOKIE_CATEGORY_INFO, COOKIE_INVENTORY, OPTIONAL_COOKIE_CATEGORIES, type OptionalCookieCategory } from "@/lib/cookies/inventory";
import { CONSENT_CHANGE_EVENT, OPEN_PREFERENCES_EVENT, readConsent, writeConsent, type ConsentChoices } from "@/lib/cookies/consent";

const SERVER = "__server__";

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, callback);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, callback);
}

/** The consent cookie as a stable snapshot string ("" = no choice yet; "__server__" during SSR). */
function useConsentSnapshot(): string {
  return useSyncExternalStore(
    subscribe,
    () => {
      const consent = readConsent();
      return consent ? JSON.stringify(consent) : "";
    },
    () => SERVER
  );
}

const ALL_OFF: ConsentChoices = { functional: false, analytics: false, marketing: false };
const ALL_ON: ConsentChoices = { functional: true, analytics: true, marketing: true };

/**
 * P20 — Cookie Policy §5: Accept All / Reject Non-Essential / Manage
 * Preferences. Non-essential technologies are never treated as accepted
 * just because the visitor keeps browsing; the choice is stored in a
 * first-party cookie and optional scripts only load through <ConsentGate>.
 */
export function CookieConsent() {
  const snapshot = useConsentSnapshot();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentChoices>(ALL_OFF);

  useEffect(() => {
    const open = () => {
      const current = readConsent();
      setDraft(current ? { functional: current.functional, analytics: current.analytics, marketing: current.marketing } : ALL_OFF);
      setPreferencesOpen(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, open);
  }, []);

  useEffect(() => {
    if (!preferencesOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreferencesOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preferencesOpen]);

  const decide = (choices: ConsentChoices) => {
    writeConsent(choices);
    setPreferencesOpen(false);
  };

  const showBanner = snapshot === "" && !preferencesOpen;

  return (
    <>
      {showBanner ? (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-surface-1/95 shadow-[0_-8px_24px_-12px_rgb(0_0_0_/_25%)] backdrop-blur"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-ink-secondary">
              <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-accent-on-light" aria-hidden="true" />
              <span>
                We use necessary cookies to run this website. With your permission we may also use optional cookies. See our{" "}
                <Link href="/legal/cookie-policy" className="text-ink-accent underline">
                  Cookie Policy
                </Link>
                .
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => { setDraft(ALL_OFF); setPreferencesOpen(true); }}>
                Manage Preferences
              </Button>
              <Button type="button" size="sm" variant="glass" onClick={() => decide(ALL_OFF)}>
                Reject Non-Essential
              </Button>
              <Button type="button" size="sm" onClick={() => decide(ALL_ON)}>
                Accept All
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {preferencesOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-primary/40 p-4 sm:items-center" onClick={() => setPreferencesOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-preferences-title"
            className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-hairline bg-surface-1 p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="cookie-preferences-title" className="text-base font-semibold text-ink-heading">
                Cookie preferences
              </h2>
              <button type="button" onClick={() => setPreferencesOpen(false)} aria-label="Close" className="rounded-full p-1 text-ink-tertiary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Cookie categories</legend>
              <label className="flex items-start gap-3 rounded-lg border border-hairline p-3">
                <input type="checkbox" checked disabled className="mt-1" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-ink-primary">{COOKIE_CATEGORY_INFO.necessary.label} (always on)</span>
                  <span className="text-xs text-ink-tertiary">{COOKIE_CATEGORY_INFO.necessary.description}</span>
                </span>
              </label>
              {OPTIONAL_COOKIE_CATEGORIES.map((category: OptionalCookieCategory) => {
                const inUse = COOKIE_INVENTORY.filter((entry) => entry.category === category).length;
                return (
                  <label key={category} className="flex items-start gap-3 rounded-lg border border-hairline p-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={draft[category]}
                      onChange={(event) => setDraft({ ...draft, [category]: event.target.checked })}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-ink-primary">{COOKIE_CATEGORY_INFO[category].label}</span>
                      <span className="text-xs text-ink-tertiary">
                        {COOKIE_CATEGORY_INFO[category].description} {inUse === 0 ? "Not currently used on this website." : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="glass" onClick={() => decide(ALL_OFF)}>
                Reject Non-Essential
              </Button>
              <Button type="button" size="sm" onClick={() => decide(draft)}>
                Save preferences
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Renders `children` (an optional script/embed) only once the visitor has consented to `category`. */
export function ConsentGate({ category, children }: { category: OptionalCookieCategory; children: React.ReactNode }) {
  const snapshot = useConsentSnapshot();
  if (snapshot === "" || snapshot === SERVER) return null;
  const consent = JSON.parse(snapshot) as ConsentChoices;
  return consent[category] ? <>{children}</> : null;
}

/** Footer link that re-opens the preferences dialog. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))}>
      Cookie settings
    </button>
  );
}
