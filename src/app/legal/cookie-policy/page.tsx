import { LegalDocument, legalPageMetadata } from "@/components/layout/LegalDocument";

// Copy from Admin → Legal Pages (original: Company_Support_Legal_General_FAQ_23_Sep_2026.docx).
export const revalidate = 300;

export function generateMetadata() {
  return legalPageMetadata("cookie-policy");
}

export default function CookiePolicyPage() {
  return <LegalDocument slug="cookie-policy" />;
}