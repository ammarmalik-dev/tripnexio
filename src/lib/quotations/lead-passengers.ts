import { db } from "../db";

/** The lead's own passengers (Lead.details.passengerIds, in order), for per-passenger quote lines. */
export async function leadPassengersFor(details: unknown): Promise<{ id: string; fullName: string }[]> {
  const ids = ((details ?? {}) as Record<string, unknown>).passengerIds;
  const passengerIds = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  if (passengerIds.length === 0) return [];
  const rows = await db.passenger.findMany({ where: { id: { in: passengerIds } }, select: { id: true, fullName: true } });
  return passengerIds.map((id) => rows.find((row) => row.id === id)).filter((row): row is { id: string; fullName: string } => Boolean(row));
}
