import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Grievance Redressal",
  description: "How to raise a formal grievance with TripNexio and the applicable acknowledgement timeframes.",
};

/**
 * New page — this didn't exist before. Locked content from
 * TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx §14.
 * Effective Date: 23 September 2026.
 *
 * The doc's own Grievance Officer Name/Email/Phone/Postal Address fields are all
 * "[TO BE ADDED]" — per that doc's own Contact section developer note, these must
 * stay as configuration values until the client supplies them, never invented. Until
 * a named officer is confirmed, this page points to TripNexio's existing real support
 * channels (already live in site-config.ts) rather than fabricating an officer identity.
 */
export default function GrievanceRedressalPage() {
  return (
    <LegalDocument
      title="Grievance Redressal"
      effectiveDate="23 September 2026"
      intro="TripNexio aims to resolve customer concerns fairly, transparently and within applicable legal timeframes. Customers should first contact customer support so that the issue can be reviewed and, where possible, resolved promptly."
      sections={[
        {
          heading: "Raising a formal grievance",
          paragraphs: [
            "For a formal grievance, use the grievance contact details below. The live website must prominently publish the name and contact details of the designated Grievance Officer and the complaint mechanism once these details are finalized — a named Grievance Officer has not yet been confirmed, so grievances should be raised through TripNexio's published support channels in the meantime.",
          ],
        },
        {
          heading: "Grievance Officer",
          paragraphs: [
            `Designation: Grievance Officer. Name, dedicated grievance email/phone and postal address will be published here once confirmed. Until then, contact ${siteConfig.contact.email} or ${siteConfig.contact.phone}.`,
          ],
        },
        {
          heading: "Acknowledgement and resolution timeframes",
          paragraphs: [
            "On receipt of a consumer complaint, the applicable grievance mechanism should provide an acknowledgement within the legally applicable timeframe and a tracking reference where supported. For the Consumer Protection (E-Commerce) Rules, 2020, the published rule requires acknowledgement of a consumer complaint within 48 hours and redressal within one month of receipt.",
          ],
        },
        {
          heading: "Your statutory rights",
          paragraphs: [
            "Nothing in this page prevents a customer from using any statutory consumer or other legal remedy available under applicable law.",
          ],
        },
      ]}
    />
  );
}
