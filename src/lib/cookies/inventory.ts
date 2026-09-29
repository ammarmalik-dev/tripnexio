/**
 * P20 — the live cookie / similar-technology inventory (Cookie Policy §8 +
 * developer requirement: "Maintain a live cookie/technology inventory,
 * classify essential vs optional technologies"). Keep this in sync with
 * production: add a row whenever a new analytics, advertising, security,
 * payment, authentication or support provider goes live, and load any
 * optional script only through <ConsentGate category="..."> so it stays
 * blocked until the visitor consents.
 */
export type CookieCategory = "necessary" | "functional" | "analytics" | "marketing";

export const OPTIONAL_COOKIE_CATEGORIES = ["functional", "analytics", "marketing"] as const;
export type OptionalCookieCategory = (typeof OPTIONAL_COOKIE_CATEGORIES)[number];

export const COOKIE_CATEGORY_INFO: Record<CookieCategory, { label: string; description: string }> = {
  necessary: {
    label: "Necessary",
    description: "Help the website operate, maintain sessions, provide security and complete essential requests. Always on.",
  },
  functional: { label: "Functionality", description: "Remember choices and preferences." },
  analytics: { label: "Analytics / performance", description: "Help measure website usage and improve performance." },
  marketing: { label: "Advertising / targeting", description: "If used, may support relevant marketing." },
};

export interface CookieInventoryEntry {
  name: string;
  category: CookieCategory;
  provider: string;
  purpose: string;
  duration: string;
}

/** The consent choice itself — a necessary cookie (it has to be remembered to be respected). */
export const CONSENT_COOKIE_NAME = "tnx_cookie_consent";
export const CONSENT_COOKIE_MAX_AGE_DAYS = 180;

export const COOKIE_INVENTORY: CookieInventoryEntry[] = [
  { name: CONSENT_COOKIE_NAME, category: "necessary", provider: "TripNexio", purpose: "Remembers your cookie choices.", duration: `${CONSENT_COOKIE_MAX_AGE_DAYS} days` },
  { name: "tnx_customer_session", category: "necessary", provider: "TripNexio", purpose: "Keeps you signed in to your TripNexio account (HttpOnly, Secure).", duration: "Session length set at sign-in" },
  { name: "tnx_google_oauth", category: "necessary", provider: "TripNexio", purpose: "Protects the Google Sign-In flow (short-lived state check).", duration: "Minutes" },
  { name: "tnx_staff_session", category: "necessary", provider: "TripNexio", purpose: "Staff sign-in for the internal CRM only (HttpOnly, Secure).", duration: "8 hours" },
  { name: "Razorpay checkout", category: "necessary", provider: "Razorpay", purpose: "Secure payment processing on the payment page, when you pay online.", duration: "Set by the provider" },
];

/** True when there is at least one optional technology to consent to. */
export function hasOptionalTechnologies(): boolean {
  return COOKIE_INVENTORY.some((entry) => entry.category !== "necessary");
}
