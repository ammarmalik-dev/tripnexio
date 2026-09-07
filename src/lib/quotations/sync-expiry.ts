import { db } from "../db";
import { writeAudit } from "../audit/log";
import { sendNotificationEmail } from "../notifications/send-notification-email";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { formatLeadReference } from "../leads/reference";
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

  // Fires once per quotation, exactly when it flips from not-expired to
  // expired above — this function only ever runs the update once per
  // quotation (the `!quotation.isExpired` filter above), so this can't
  // double-send on a later list/select call re-reading the same quotation.
  for (const quotation of dueToExpire) {
    const lead = await db.lead.findUnique({ where: { id: quotation.leadId }, include: { customer: true } });
    if (!lead) continue;
    await sendNotificationEmail({
      event: NOTIFICATION_EVENTS.QUOTE_EXPIRED,
      to: lead.customer.email,
      variables: { customerName: lead.customer.name, leadReference: formatLeadReference(lead.serviceType, lead.id) },
      auditTarget: { entityType: "Quotation", entityId: quotation.id },
    });
  }

  return quotations.map((quotation) => (updatedById.get(quotation.id) as T) ?? quotation);
}
