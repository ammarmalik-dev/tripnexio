import { LegalDocument, legalPageMetadata } from "@/components/layout/LegalDocument";
import { getSiteContact, getSystemConfig } from "@/lib/settings/system-config";

// Copy from Admin → Legal Pages (original: Company_Support_Legal_General_FAQ_23_Sep_2026.docx §14);
// Grievance Officer details from Admin → System Configuration.
export const revalidate = 300;

export function generateMetadata() {
  return legalPageMetadata("grievance-redressal");
}

const paragraphClass = "text-sm leading-relaxed text-ink-secondary sm:text-[15px]";

/**
 * P20 — only the officer details Admin has filled in are published, never a
 * placeholder. Until a named officer with a contact is set, the page points to
 * TripNexio's real support channels rather than an invented identity.
 */
export default async function GrievanceRedressalPage() {
  const config = await getSystemConfig();
  const site = await getSiteContact();
  const officer = [
    config.grievanceOfficerName ? ["Name", config.grievanceOfficerName] : null,
    ["Designation", "Grievance Officer"],
    config.grievanceEmail ? ["Email", config.grievanceEmail] : null,
    config.grievancePhone ? ["Phone / WhatsApp", config.grievancePhone] : null,
    config.grievanceAddress ? ["Postal address", config.grievanceAddress] : null,
  ].filter((row): row is [string, string] => row !== null);
  const officerConfirmed = Boolean(config.grievanceOfficerName && (config.grievanceEmail || config.grievancePhone));

  return (
    <LegalDocument
      slug="grievance-redressal"
      tokens={{
        grievanceIntro: (
          <p className={paragraphClass}>
            {officerConfirmed
              ? "For a formal grievance, use the grievance contact details below."
              : `For a formal grievance, use the grievance contact details below. Until the Grievance Officer's direct contact details are published here, raise your grievance through TripNexio's support channels: ${site.email} or ${site.phone}.`}
          </p>
        ),
        grievanceOfficer: (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-hairline bg-surface-1 p-4 text-sm sm:grid-cols-[max-content_1fr]">
              {officer.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-ink-tertiary">{label}</dt>
                  <dd className="font-medium text-ink-primary">{value}</dd>
                </div>
              ))}
            </dl>
            <p className={paragraphClass}>Complaint ticket / reference: issued by TripNexio after registration, where supported.</p>
          </div>
        ),
      }}
    />
  );
}
