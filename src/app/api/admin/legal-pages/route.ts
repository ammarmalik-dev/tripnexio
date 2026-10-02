import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { DEFAULT_LEGAL_PAGES } from "@/lib/legal/default-pages";
import { LEGAL_PAGE_SLUGS } from "@/lib/legal/pages";

/** Every About/legal page with its live copy (edited row, else the original) and whether it has been edited. */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  try {
    const rows = await db.legalPage.findMany();
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    return jsonSuccess(
      LEGAL_PAGE_SLUGS.map((slug) => {
        const row = bySlug.get(slug);
        const content = row
          ? {
              title: row.title,
              eyebrow: row.eyebrow,
              intro: row.intro,
              effectiveDate: row.effectiveDate,
              showReviewNotice: row.showReviewNotice,
              body: row.body,
            }
          : DEFAULT_LEGAL_PAGES[slug];
        return { slug, customized: Boolean(row), updatedAt: row?.updatedAt ?? null, content, original: DEFAULT_LEGAL_PAGES[slug] };
      })
    );
  } catch (error) {
    console.error("[api/admin/legal-pages] list failed", error);
    return jsonError(500, "Couldn't load the legal pages. Please try again.");
  }
}
