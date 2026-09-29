import type { Metadata } from "next";
import { LegalDocument } from "@/components/layout/LegalDocument";
import { getEffectiveSiteConfig, getSystemConfig } from "@/lib/settings/system-config";

// P20 — Grievance Officer details come from Admin → System Configuration.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Grievance Redressal",
  description: "How to raise a formal grievance with TripNexio and the applicable acknowledgement timeframes.",
};

/**
 * New page — this didn't exist before. Locked content from
 * TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx §14.
 * Effective Date: 23 September 2026.
 *
 * The doc's Grievance Officer Name/Email/Phone/Postal Address are "[TO BE ADDED]"
 * — P20: they're Admin → System Configuration fields, and only the ones filled in
 * are published. Until a named officer with a contact is set, the page points to
 * TripNexio's real support channels rather than a placeholder or invented identity.
 */
export default async function GrievanceRedressalPage() {
  const [config, site] = await Promise.all([getSystemConfig(), getEffectiveSiteConfig()]);
  // Only the details Admin has filled in are published — never a placeholder.
  const officer = [
    config.grievanceOfficerName ? `Name: ${config.grievanceOfficerName}` : null,
    "Designation: Grievance Officer",
    config.grievanceEmail ? `Email: ${config.grievanceEmail}` : null,
    config.grievancePhone ? `Phone / WhatsApp: ${config.grievancePhone}` : null,
    config.grievanceAddress ? `Postal address: ${config.grievanceAddress}` : null,
    "Complaint ticket / reference: issued by TripNexio after registration, where supported.",
  ].filter((line): line is string => line !== null);
  const officerConfirmed = Boolean(config.grievanceOfficerName && (config.grievanceEmail || config.grievancePhone));
  return (
    <LegalDocument
      title="Grievance Redressal"
      effectiveDate="23 September 2026"
      intro="TripNexio aims to resolve customer concerns fairly, transparently and within applicable legal timeframes. Customers should first contact customer support so that the issue can be reviewed and, where possible, resolved promptly."
      sections={[
        {
          heading: "Raising a formal grievance",
          paragraphs: [
            officerConfirmed
              ? "For a formal grievance, use the grievance contact details below."
              : `For a formal grievance, use the grievance contact details below. Until the Grievance Officer's direct contact details are published here, raise your grievance through TripNexio's support channels: ${site.email} or ${site.phone}.`,
          ],
        },
        {
          heading: "Grievance Officer",
          paragraphs: officer,
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
