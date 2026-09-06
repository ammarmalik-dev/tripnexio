import { db } from "../db";
import { writeAudit } from "../audit/log";
import type { Quotation } from "../../generated/prisma/client";

export function isExpiredNow(quotation: Pick<Quotation, "validityExpiresAt" | "isExpired">): boolean {
  return quotation.isExpired || Boolean(quotation.validityExpiresAt && quotation.validityExpiresAt.getTime() < Date.now());
}

/**
 * Lazily marks any past-due quotations as expired — there's no cron job in
 * M2, so this runs whenever quotations are read (list/select) instead.
 */
export async function syncExpiredQuotations<T extends Quotation>(quotations: T[]): Promise<T[]> {
  const dueToExpire = quotations.filter((quotation) => !quotation.isExpired && isExpiredNow(quotation));
  if (dueToExpire.length === 0) return quotations;

  const updatedById = await db.$transaction(async (tx) => {
    const map = new Map<string, Quotation>();
    for (const quotation of dueToExpire) {
      const fresh = await tx.quotation.update({
        where: { id: quotation.id },
        data: { isExpired: true, isSelected: false },
      });
      await writeAudit(tx, {
        entityType: "Quotation",
        entityId: quotation.id,
        action: "EXPIRE",
        note: "Expired automatically — validityExpiresAt passed",
      });
      map.set(quotation.id, fresh);
    }
    return map;
  });

  return quotations.map((quotation) => (updatedById.get(quotation.id) as T) ?? quotation);
}
