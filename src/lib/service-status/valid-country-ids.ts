import { db } from "../db";

/** Client doc 16 Nov (G1) — the status's countries, de-duplicated; null when one of them is not a known country. */
export async function validCountryIds(ids: string[] | undefined): Promise<string[] | null> {
  const unique = Array.from(new Set(ids ?? []));
  if (unique.length === 0) return [];
  const found = await db.country.count({ where: { id: { in: unique } } });
  return found === unique.length ? unique : null;
}
