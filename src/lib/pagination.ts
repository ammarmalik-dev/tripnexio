/**
 * Shared list pagination defaults for every CRM/Admin table and list
 * (client request 2026-10-01: show the first 10 entries, then paginate,
 * with an entries-per-page choice). The API list schemas allow up to 100.
 */
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Page numbers to render, with "gap" markers: always the first and last
 * page, plus `siblings` pages either side of the current one.
 * e.g. (6, 12) gives [1, "gap", 5, 6, 7, "gap", 12].
 */
export function pageWindow(page: number, totalPages: number, siblings = 1): (number | "gap")[] {
  if (totalPages <= 5 + siblings * 2) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Math.max(2, page - siblings);
  const end = Math.min(totalPages - 1, page + siblings);
  const pages: (number | "gap")[] = [1];
  if (start > 2) pages.push("gap");
  for (let current = start; current <= end; current++) pages.push(current);
  if (end < totalPages - 1) pages.push("gap");
  pages.push(totalPages);
  return pages;
}
