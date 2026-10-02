import { cache } from "react";
import { db } from "../db";
import { DEFAULT_LEGAL_PAGES } from "./default-pages";
import type { LegalPageContent, LegalPageSlug } from "./pages";

/**
 * A page's live copy: the Admin-edited row if there is one, else the
 * original locked copy. A database error falls back to the original copy so
 * a legal page never goes blank.
 */
export const getLegalPage = cache(async (slug: LegalPageSlug): Promise<LegalPageContent & { customized: boolean }> => {
  try {
    const row = await db.legalPage.findUnique({ where: { slug } });
    if (row) {
      return {
        title: row.title,
        eyebrow: row.eyebrow,
        intro: row.intro,
        effectiveDate: row.effectiveDate,
        showReviewNotice: row.showReviewNotice,
        body: row.body,
        customized: true,
      };
    }
  } catch (error) {
    console.error(`[legal] couldn't load page "${slug}", using the original copy`, error);
  }
  return { ...DEFAULT_LEGAL_PAGES[slug], customized: false };
});
