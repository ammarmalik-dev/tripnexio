import type { PaymentPurpose } from "../../generated/prisma/enums";
import { db } from "../db";
import { isExpiredNow } from "../quotations/sync-expiry";
import { QUOTATION_EXPIRED_MESSAGE, REQUEST_CANCELLED_MESSAGE } from "./not-payable-messages";

export { QUOTATION_EXPIRED_MESSAGE, REQUEST_CANCELLED_MESSAGE };

/**
 * Shared "can this payment still be paid?" check for every service whose
 * quotation carries a validityExpiresAt. Returns null when payable, otherwise
 * the customer-safe reason. EXTRA payments are standalone add-on charges not
 * priced from a quotation, so they are always payable here.
 *
 * A PRIMARY payment whose lead has no selected quotation is treated as
 * expired: selection is only ever removed by expiry or by selecting a
 * different quotation, so a missing selection means the quote it was priced
 * from is no longer valid.
 */
export async function assertQuotationPayable(payment: { purpose: PaymentPurpose; booking: { leadId: string; id?: string } }): Promise<string | null> {
  // Live test 2026-10-26 — a cancelled lead (Lost/Closed) or a cancelled/refunded booking kept a payable link.
  const lead = await db.lead.findUnique({ where: { id: payment.booking.leadId }, select: { status: true } });
  if (lead && (lead.status === "LOST" || lead.status === "CLOSED")) return REQUEST_CANCELLED_MESSAGE;
  if (payment.booking.id) {
    const booking = await db.booking.findUnique({ where: { id: payment.booking.id }, select: { status: true } });
    if (booking && (booking.status === "CANCELLED" || booking.status === "REFUNDED")) return REQUEST_CANCELLED_MESSAGE;
  }

  if (payment.purpose === "EXTRA") return null;

  const quotation = await db.quotation.findFirst({
    where: { leadId: payment.booking.leadId, isSelected: true },
    orderBy: { updatedAt: "desc" },
    select: { validityExpiresAt: true, isExpired: true },
  });
  if (!quotation || isExpiredNow(quotation)) return QUOTATION_EXPIRED_MESSAGE;
  return null;
}
