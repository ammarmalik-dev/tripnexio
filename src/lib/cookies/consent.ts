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

/**
 * Client doc 2026-10-20 (M3) — the banner shows once: the choice is kept on the whole site domain (www and
 * the bare domain share it) with a localStorage copy for browsers that drop the cookie between visits.
 */
function storedConsentText(): string | null {
  const raw = document.cookie.split("; ").find((part) => part.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (raw) return decodeURIComponent(raw.slice(CONSENT_COOKIE_NAME.length + 1));
  try {
    return window.localStorage.getItem(CONSENT_COOKIE_NAME);
  } catch {
    return null;
  }
}

/** ".tripnexio.com" on the live site (so www and the bare domain share the choice); host-only elsewhere. */
function cookieDomain(): string {
  const host = window.location.hostname;
  const parts = host.split(".");
  if (host === "localhost" || /^[\d.]+$/.test(host) || parts.length < 2) return "";
  return `; Domain=.${parts.slice(-2).join(".")}`;
}

export function readConsent(): StoredConsent | null {
  if (typeof document === "undefined") return null;
  const text = storedConsentText();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Partial<StoredConsent>;
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
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${CONSENT_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60}; Path=/${cookieDomain()}; SameSite=Lax${secure}`;
  try {
    window.localStorage.setItem(CONSENT_COOKIE_NAME, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode) — the cookie alone still holds the choice.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: value }));
  return value;
}

/** Re-opens the preferences dialog (e.g. from the footer "Cookie settings" link). */
export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}
