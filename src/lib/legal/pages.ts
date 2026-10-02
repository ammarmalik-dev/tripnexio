/** The About and legal pages whose copy is managed in Admin → Legal Pages. Client-safe (no server imports). */
export const LEGAL_PAGE_SLUGS = ["about", "terms", "privacy", "refund-policy", "cookie-policy", "disclaimer", "grievance-redressal"] as const;
export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

export interface LegalPageContent {
  title: string;
  eyebrow: string | null;
  intro: string;
  effectiveDate: string | null;
  showReviewNotice: boolean;
  body: string;
}

export const LEGAL_PAGE_META: Record<LegalPageSlug, { label: string; path: string; tokens: { token: string; meaning: string }[] }> = {
  about: { label: "About Us", path: "/about", tokens: [] },
  terms: {
    label: "Terms & Conditions",
    path: "/legal/terms",
    tokens: [{ token: "{{jurisdictionClause}}", meaning: "Governing-law sentence, naming the jurisdiction set in System Configuration" }],
  },
  privacy: { label: "Privacy Policy", path: "/legal/privacy", tokens: [] },
  "refund-policy": { label: "Refund & Cancellation Policy", path: "/legal/refund-policy", tokens: [] },
  "cookie-policy": { label: "Cookie Policy", path: "/legal/cookie-policy", tokens: [] },
  disclaimer: { label: "Disclaimer", path: "/legal/disclaimer", tokens: [] },
  "grievance-redressal": {
    label: "Grievance Redressal",
    path: "/legal/grievance-redressal",
    tokens: [
      { token: "{{grievanceIntro}}", meaning: "How to raise a grievance (uses the officer's details once set, otherwise the support email/phone)" },
      { token: "{{grievanceOfficer}}", meaning: "Grievance Officer details from System Configuration" },
    ],
  },
};

export function isLegalPageSlug(value: string): value is LegalPageSlug {
  return (LEGAL_PAGE_SLUGS as readonly string[]).includes(value);
}
