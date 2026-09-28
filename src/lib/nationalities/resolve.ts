import { db } from "../db";
import { jsonError } from "../api/respond";

/**
 * Admin writes to PricingRule/DocumentRequirement pick a nationality from the
 * master by id (P06). The row stores the id plus the name (kept for display
 * and for older readers that match on text):
 *   - `nationalityId` a string → that nationality (400 if it doesn't exist)
 *   - `nationalityId` null     → "all nationalities" (both columns cleared)
 *   - `nationalityId` omitted  → nationality left as-is (or the legacy
 *     free-text `nationality` the caller sent)
 */
export async function resolveNationalityInput(input: { nationalityId?: string | null; nationality?: string }) {
  if (input.nationalityId === undefined) {
    return input.nationality !== undefined ? { data: { nationality: input.nationality } } : { data: {} };
  }
  if (input.nationalityId === null) return { data: { nationalityId: null, nationality: null } };
  const row = await db.nationality.findUnique({ where: { id: input.nationalityId }, select: { id: true, name: true } });
  if (!row) return { error: jsonError(400, "Nationality not found.", { nationalityId: ["Select a valid nationality."] }) };
  return { data: { nationalityId: row.id, nationality: row.name } };
}
