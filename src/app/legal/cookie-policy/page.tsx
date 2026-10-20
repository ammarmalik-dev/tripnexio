import { LegalDocument, legalPageMetadata } from "@/components/layout/LegalDocument";
import { CookieSettingsLink } from "@/components/cookies/CookieConsent";

// Copy from Admin → Legal Pages (original: Company_Support_Legal_General_FAQ_23_Sep_2026.docx).
export const revalidate = 300;

export function generateMetadata() {
  return legalPageMetadata("cookie-policy");
}

export default function CookiePolicyPage() {
  // Client doc 2026-10-20 (M2) — "Cookie settings" moved here from the footer's bottom line.
  return (
    <LegalDocument slug="cookie-policy">
      <CookieSettingsLink className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />
    </LegalDocument>
  );
}