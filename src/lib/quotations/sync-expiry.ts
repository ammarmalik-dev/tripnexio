import { db } from "../db";
import { writeAudit } from "../audit/log";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { formatLeadReference } from "../leads/reference";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import type { Quotation } from "../../generated/prisma/client";

export function isExpiredNow(quotation: Pick<Quotation, "validityExpiresAt" | "isExpired">): boolean {
  return quotation.isExpired || Boolean(quotation.validityExpiresAt && quotation.validityExpiresAt.getTime() < Date.now());
}

/**
 * Lazily marks any past-due quotations as expired — runs whenever quotations
 * are read (list/select) and from the quote-expiry automation. A selected
 * quotation, or one on a lead whose booking already has a SUCCESS payment,
 * is never flipped: it has been accepted/paid, so expiring it would deselect
 * the quote the booking was priced from and notify the customer wrongly.
 * Payability of a selected quote is still time-checked by isExpiredNow().
 */
export async function syncExpiredQuotations<T extends Quotation>(quotations: T[]): Promise<T[]> {
  const pastDue = quotations.filter((quotation) => !quotation.isSelected && !quotation.isExpired && isExpiredNow(quotation));
  if (pastDue.length === 0) return quotations;

  const paidLeads = await db.payment.findMany({
    where: { status: "SUCCESS", booking: { leadId: { in: [...new Set(pastDue.map((quotation) => quotation.leadId))] } } },
    select: { booking: { select: { leadId: true } } },
  });
  const paidLeadIds = new Set(paidLeads.map((payment) => payment.booking.leadId));
  const dueToExpire = pastDue.filter((quotation) => !paidLeadIds.has(quotation.leadId));
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
    await notifyCustomer({
      event: NOTIFICATION_EVENTS.QUOTE_EXPIRED,
      emailTo: lead.customer.email,
      whatsappTo: toWhatsAppId(lead.customer.mobile),
      smsTo: toWhatsAppId(lead.customer.mobile),
      variables: { customerName: lead.customer.name, leadReference: formatLeadReference(lead.serviceType, lead.id) },
      auditTarget: { entityType: "Quotation", entityId: quotation.id },
    });
  }

  return quotations.map((quotation) => (updatedById.get(quotation.id) as T) ?? quotation);
}
