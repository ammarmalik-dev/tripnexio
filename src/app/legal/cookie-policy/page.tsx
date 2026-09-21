import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How TripNexio uses cookies and similar technologies.",
};

export default function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      intro="What cookies this website uses and why."
      sections={[
        {
          heading: "What cookies are",
          paragraphs: ["Small files a website stores in your browser so it can work properly and remember things between visits."],
        },
        {
          heading: "What we use them for",
          paragraphs: [
            "Essential cookies keep staff sign-in sessions secure. The public website itself uses only what is needed to work; we do not use cookies to show you advertising.",
          ],
        },
        {
          heading: "Your control",
          paragraphs: [
            "You can clear or block cookies in your browser settings. Blocking essential cookies may stop parts of the site, such as staff sign-in, from working.",
          ],
        },
      ]}
    />
  );
}
