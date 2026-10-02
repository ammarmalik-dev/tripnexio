import { LegalDocument, legalPageMetadata } from "@/components/layout/LegalDocument";

// Copy from Admin → Legal Pages (original: Company_Support_Legal_General_FAQ_23_Sep_2026.docx).
export const revalidate = 300;

export function generateMetadata() {
  return legalPageMetadata("privacy");
}

export default function PrivacyPolicyPage() {
  return <LegalDocument slug="privacy" />;
}