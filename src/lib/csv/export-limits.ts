/**
 * P21 item 8 — the CSV export row cap. Kept in its own dependency-free
 * module (not export-guard.ts, which imports the Prisma client) so client
 * components can show the cap without bundling server code.
 */
export const MAX_EXPORT_ROWS = 10_000;
/** Queried as cap + 1 so truncation is detectable without a second COUNT query. */
export const EXPORT_QUERY_TAKE = MAX_EXPORT_ROWS + 1;
