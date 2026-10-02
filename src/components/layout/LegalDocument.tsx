import type { Metadata } from "next";
import type { ReactNode } from "react";
import { InfoPage } from "./InfoPage";
import { LegalMarkup } from "@/components/legal/LegalMarkup";
import { getSiteContact } from "@/lib/settings/system-config";
import { getLegalPage } from "@/lib/legal/get-legal-page";
import { LEGAL_PAGE_META, type LegalPageSlug } from "@/lib/legal/pages";

/** Page metadata from the live copy (title + intro). */
export async function legalPageMetadata(slug: LegalPageSlug): Promise<Metadata> {
  const page = await getLegalPage(slug);
  const title = slug === "about" ? "About Us" : page.title;
  const description = page.intro.length > 160 ? `${page.intro.slice(0, 157).trimEnd()}…` : page.intro;
  return { title, description, alternates: { canonical: LEGAL_PAGE_META[slug].path } };
}

/**
 * An About/legal page: heading, effective date, optional review notice and
 * the body from Admin → Legal Pages (or the original locked copy). The
 * review notice is the source document's own "Publication gate" wording;
 * Admin can switch it off per page once counsel has signed off. Contact
 * details are not repeated at the bottom (client request 2026-10-03); they
 * live on the Contact page and in the footer.
 */
export async function LegalDocument({
  slug,
  tokens,
  children,
}: {
  slug: LegalPageSlug;
  tokens?: Record<string, ReactNode>;
  /** Extra content below the body (e.g. About's buttons). */
  children?: ReactNode;
}) {
  const page = await getLegalPage(slug);
  const contact = page.showReviewNotice ? await getSiteContact() : null;

  return (
    <InfoPage eyebrow={page.eyebrow ?? undefined} title={page.title} description={page.intro}>
      {page.effectiveDate || contact ? (
        <div className="-mt-4 flex flex-col gap-3">
          {page.effectiveDate ? <p className="text-sm text-ink-tertiary">Effective Date: {page.effectiveDate}</p> : null}
          {contact ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
              Pending final legal counsel review and confirmation of {contact.legalName}&rsquo;s registered entity details before
              publication. Please contact us if you have questions about how this applies to your request.
            </p>
          ) : null}
        </div>
      ) : null}
      <LegalMarkup body={page.body} tokens={tokens} />
      {children}
    </InfoPage>
  );
}
