import { LegalDocument, legalPageMetadata } from "@/components/layout/LegalDocument";
import { getSystemConfig } from "@/lib/settings/system-config";

// Copy from Admin → Legal Pages (original: Company_Support_Legal_General_FAQ_23_Sep_2026.docx §9);
// the jurisdiction from Admin → System Configuration.
export const revalidate = 300;

export function generateMetadata() {
  return legalPageMetadata("terms");
}

export default async function TermsPage() {
  const { jurisdiction } = await getSystemConfig();
  // P20 — no placeholder on the live site: the courts/authorities sentence appears once Admin sets the jurisdiction.
  const jurisdictionClause = jurisdiction
    ? `These Terms are intended to be governed by the laws of India. The competent courts/authorities at ${jurisdiction} will have jurisdiction, subject to applicable consumer and other mandatory legal remedies.`
    : "These Terms are intended to be governed by the laws of India, subject to applicable consumer and other mandatory legal remedies.";
  return (
    <LegalDocument
      slug="terms"
      tokens={{ jurisdictionClause: <p className="text-sm leading-relaxed text-ink-secondary sm:text-[15px]">{jurisdictionClause}</p> }}
    />
  );
}
