import { ButtonLink } from "@/components/ui/ButtonLink";
import { LegalDocument, legalPageMetadata } from "@/components/layout/LegalDocument";
import { getSiteContact } from "@/lib/settings/system-config";

// Copy from Admin → Legal Pages (original: Company_Support_Legal_General_FAQ_23_Sep_2026.docx §2);
// the WhatsApp link from Admin → System Configuration.
export const revalidate = 300;

export function generateMetadata() {
  return legalPageMetadata("about");
}

export default async function AboutPage() {
  const contact = await getSiteContact();
  return (
    <LegalDocument slug="about">
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/services">Explore Services</ButtonLink>
        <ButtonLink href={contact.whatsappHref} variant="glass">
          WhatsApp Support
        </ButtonLink>
      </div>
    </LegalDocument>
  );
}
