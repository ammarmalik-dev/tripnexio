/**
 * Shared by pages.ts and the per-page section files (kept apart so those files can use the helpers without an import cycle).
 */

/**
 * Client confirmation 2026-10-25 — "make every website page section editable through Admin, including text, images,
 * headings, banners and service content". A section field is keyed "<section>.<name>" and stored next to the hero
 * fields in SitePageContent.fields:
 * - text / multiline: the text itself;
 * - list: one item per line, its parts split by "|" (e.g. "Title | description");
 * - image: an uploaded file id (set only by the image upload route, never by the wording save).
 * `fallback` is the page's original copy (for an image, the built-in picture path), shown while the field is blank.
 */
export type SiteSectionFieldKind = "text" | "multiline" | "list" | "image";

export interface SiteSectionField {
  key: string;
  label: string;
  kind: SiteSectionFieldKind;
  hint?: string;
  fallback: string;
}

export interface SiteSection {
  id: string;
  label: string;
  fields: SiteSectionField[];
}

/** "a | b | c" lines → rows of trimmed parts (blank lines dropped). */
export function parseListLines(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter((parts) => parts.some(Boolean));
}

/** Rows → "a | b | c" lines (the inverse of parseListLines), for writing a list field's fallback. */
export const listLines = (rows: string[][]): string => rows.map((row) => row.join(" | ")).join("\n");
