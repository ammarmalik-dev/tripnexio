import { db } from "../db";
import { SITE_PAGE_DEFS, parseListLines, parseStepLines, sectionFields, sitePageImageUrl, type SitePage } from "./pages";

export { sitePageImageUrl };

export interface SitePageContentView {
  /** Admin's text for a hero field or a section field ("<section>.<name>"), or the page's original copy when blank. */
  text: (key: string) => string;
  /**
   * Client confirmation 2026-10-25 — a section list field: Admin's lines (each split by "|"), or the original
   * items. Every row has at least `minParts` entries (missing parts are "").
   */
  list: (key: string, minParts?: number) => string[][];
  /** A section image field: Admin's uploaded picture, or the built-in one. */
  image: (key: string) => string;
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
  const sections = sectionFields(page);
  let stored: Record<string, unknown> = {};
  let heroImageUrl: string | null = null;
  try {
    const row = await db.sitePageContent.findUnique({ where: { page } });
    if (row?.fields && typeof row.fields === "object" && !Array.isArray(row.fields)) stored = row.fields as Record<string, unknown>;
    heroImageUrl = sitePageImageUrl(row?.heroImageFileId);
  } catch (error) {
    console.error(`[site-content] couldn't load ${page}`, error);
  }

  const storedText = (key: string): string | null => {
    const value = stored[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  const fallbackOf = (key: string): string => def.fields.find((field) => field.key === key)?.fallback ?? sections.get(key)?.fallback ?? "";

  const text = (key: string): string => storedText(key) ?? fallbackOf(key);

  const list = (key: string, minParts = 1): string[][] => {
    const own = storedText(key);
    const rows = own ? parseListLines(own) : [];
    const chosen = rows.length > 0 ? rows : parseListLines(fallbackOf(key));
    return chosen.map((row) => (row.length >= minParts ? row : [...row, ...Array<string>(minParts - row.length).fill("")]));
  };

  const image = (key: string): string => sitePageImageUrl(storedText(key)) ?? fallbackOf(key);

  const steps = <T extends { headline: string; supportingCopy: string }>(defaults: T[]): T[] => {
    const value = stored.steps;
    const edited = typeof value === "string" ? parseStepLines(value) : null;
    if (!edited) return defaults;
    // Client confirmation 2026-10-25 — exactly 4 steps on every service page.
    return edited.slice(0, 4).map((row, index) => ({ ...(defaults[index] ?? defaults[defaults.length - 1]), ...row, step: String(index + 1).padStart(2, "0") }));
  };

  return { text, list, image, heroImageUrl, steps };
}
