import { InfoPage } from "./InfoPage";
import { siteConfig } from "@/lib/site-config";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

/**
 * Legal pages carry a visible review notice: this is TripNexio's own locked
 * content (TripNexio_Website_Final_Company_Support_Legal_General_FAQ_23_Sep_2026.docx),
 * not developer-written placeholder text, but that same source document's own
 * "Publication gate" section says it still needs qualified legal counsel
 * review and the [TO BE ADDED] contact/entity fields filled in before this is
 * truly binding — so the notice reflects that, not "pending developer draft."
 */
export function LegalDocument({
  eyebrow = "Legal",
  title,
  intro,
  effectiveDate,
  sections,
}: {
  eyebrow?: string;
  title: string;
  intro: string;
  effectiveDate?: string;
  sections: LegalSection[];
}) {
  return (
    <InfoPage eyebrow={eyebrow} title={title} description={intro}>
      {effectiveDate ? (
        <p className="text-sm text-ink-tertiary">Effective Date: {effectiveDate}</p>
      ) : null}
      <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
        Pending final legal counsel review and confirmation of {siteConfig.legalName}&rsquo;s registered entity details
        before publication. Please contact us if you have questions about how this applies to your request.
      </p>
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-ink-heading">{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-ink-secondary">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink-heading">Contact</h2>
          <p className="text-sm text-ink-secondary">
            {siteConfig.legalName}, {siteConfig.contact.address} ·{" "}
            <a className="text-ink-accent underline" href={siteConfig.contact.emailHref}>
              {siteConfig.contact.email}
            </a>{" "}
            ·{" "}
            <a className="text-ink-accent underline" href={siteConfig.contact.phoneHref}>
              {siteConfig.contact.phone}
            </a>
          </p>
        </section>
      </div>
    </InfoPage>
  );
}
