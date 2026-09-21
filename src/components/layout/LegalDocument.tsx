import { InfoPage } from "./InfoPage";
import { siteConfig } from "@/lib/site-config";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

/**
 * Legal pages carry a visible "draft" notice: the wording below describes how
 * the platform actually works today, but binding legal text must be reviewed
 * and approved by TripNexio (and its legal adviser) before it's relied upon.
 */
export function LegalDocument({
  eyebrow = "Legal",
  title,
  intro,
  sections,
}: {
  eyebrow?: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <InfoPage eyebrow={eyebrow} title={title} description={intro}>
      <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
        Draft for review — this page is pending final approval by {siteConfig.legalName}. Please contact us if you have
        questions about how it applies to your request.
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
