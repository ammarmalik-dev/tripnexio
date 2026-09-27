import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Important limits on what TripNexio can promise about visas, flights and travel decisions.",
};

// Locked content — TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx §13.
// Effective Date: 23 September 2026.
export default function DisclaimerPage() {
  return (
    <LegalDocument
      title="Disclaimer"
      effectiveDate="23 September 2026"
      intro="Please read this before relying on any information on this website."
      sections={[
        {
          heading: "Information only",
          paragraphs: [
            "Content on the TripNexio website is provided to help customers understand supported services and process requirements. It is not a substitute for instructions issued by the relevant government, immigration, embassy, airline, airport or other competent authority.",
          ],
        },
        {
          heading: "No guarantee of outcome",
          paragraphs: [
            "TripNexio does not guarantee visa approval, eVisa issuance, immigration clearance, entry into a country, airline boarding, ticket issuance, visa extension, visa change approval or any other result controlled by a third party or authority.",
          ],
        },
        {
          heading: "Requirements can change",
          paragraphs: [
            "Visa, immigration, airline, documentation, transit and travel requirements can change without notice. A requirement shown on the website may be updated when authoritative information or provider requirements change.",
          ],
        },
        {
          heading: "Customer responsibility",
          paragraphs: [
            "Customers are responsible for ensuring that information and documents supplied to TripNexio are accurate, genuine, complete and current and for meeting applicable travel requirements.",
          ],
        },
        {
          heading: "Third-party systems",
          paragraphs: [
            "TripNexio may rely on government portals, embassy/consular systems, airline systems, payment gateways, vendors, communication systems or other third-party infrastructure. Outages, delays, changes, restrictions or failures in those systems may affect service delivery.",
          ],
        },
        {
          heading: "Travel decisions",
          paragraphs: [
            "Customers remain responsible for obtaining any required passport, visa, permit, insurance, health documentation, transit permission or other travel authorisation needed for their journey.",
          ],
        },
      ]}
    />
  );
}
