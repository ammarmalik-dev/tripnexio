"use client";

import { CONSENT_COOKIE_MAX_AGE_DAYS, CONSENT_COOKIE_NAME, type OptionalCookieCategory } from "./inventory";

export type ConsentChoices = Record<OptionalCookieCategory, boolean>;

export interface StoredConsent extends ConsentChoices {
  /** Bump when the inventory changes materially, so visitors are asked again. */
  version: number;
  decidedAt: string;
}

export const CONSENT_VERSION = 1;
export const CONSENT_CHANGE_EVENT = "tnx-consent-change";
export const OPEN_PREFERENCES_EVENT = "tnx-open-cookie-preferences";

export function readConsent(): StoredConsent | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie.split("; ").find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(CONSENT_COOKIE_NAME.length + 1))) as Partial<StoredConsent>;
    if (parsed.version !== CONSENT_VERSION) return null;
    return {
      version: CONSENT_VERSION,
      decidedAt: String(parsed.decidedAt ?? ""),
      functional: parsed.functional === true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
    };
  } catch {
    return null;
  }
}

/** Stores the choice (first-party, SameSite=Lax, Secure on HTTPS) and tells any <ConsentGate> to re-check. */
export function writeConsent(choices: ConsentChoices): StoredConsent {
  const value: StoredConsent = { ...choices, version: CONSENT_VERSION, decidedAt: new Date().toISOString() };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${CONSENT_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: value }));
  return value;
}

/** Re-opens the preferences dialog (e.g. from the footer "Cookie settings" link). */
export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}
