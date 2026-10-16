import { db } from "../db";
import { SITE_PAGE_DEFS, parseStepLines, type SitePage, type SitePageField } from "./pages";

export function sitePageImageUrl(fileId: string | null | undefined): string | null {
  return fileId ? `/api/site-pages/image/${encodeURIComponent(fileId)}` : null;
}

export interface SitePageContentView {
  /** Admin's text for the field, or the page's original copy when blank. */
  text: (key: SitePageField) => string;
  /** The uploaded hero photo, or null for the page's built-in one. */
  heroImageUrl: string | null;
  /** Admin's How It Works steps merged onto the page's own (keeping each step's number and icon). */
  steps: <T extends { headline: string; supportingCopy: string }>(defaults: T[]) => T[];
}

/**
 * Client doc 2026-10-15 (J3) — what a website page shows: Admin's edits from Admin → Website Pages over the
 * original copy. A database hiccup never breaks the page; it just shows the original copy.
 */
export async function getSitePageContent(page: SitePage): Promise<SitePageContentView> {
  const def = SITE_PAGE_DEFS[page];
  let stored: Record<string, unknown> = {};
  let heroImageUrl: string | null = null;
  try {
    const row = await db.sitePageContent.findUnique({ where: { page } });
    if (row?.fields && typeof row.fields === "object" && !Array.isArray(row.fields)) stored = row.fields as Record<string, unknown>;
    heroImageUrl = sitePageImageUrl(row?.heroImageFileId);
  } catch (error) {
    console.error(`[site-content] couldn't load ${page}`, error);
  }

  const text = (key: SitePageField): string => {
    const value = stored[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    return def.fields.find((field) => field.key === key)?.fallback ?? "";
  };

  const steps = <T extends { headline: string; supportingCopy: string }>(defaults: T[]): T[] => {
    const value = stored.steps;
    const edited = typeof value === "string" ? parseStepLines(value) : null;
    if (!edited) return defaults;
    return edited.map((row, index) => ({ ...(defaults[index] ?? defaults[defaults.length - 1]), ...row, step: String(index + 1).padStart(2, "0") }));
  };

  return { text, heroImageUrl, steps };
}
