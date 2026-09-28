import type { PaymentPurpose } from "../../generated/prisma/enums";
import { db } from "../db";
import { isExpiredNow } from "../quotations/sync-expiry";

export const QUOTATION_EXPIRED_MESSAGE = "This quotation has expired.";

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
export async function assertQuotationPayable(payment: { purpose: PaymentPurpose; booking: { leadId: string } }): Promise<string | null> {
  if (payment.purpose === "EXTRA") return null;

  const quotation = await db.quotation.findFirst({
    where: { leadId: payment.booking.leadId, isSelected: true },
    orderBy: { updatedAt: "desc" },
    select: { validityExpiresAt: true, isExpired: true },
  });
  if (!quotation || isExpiredNow(quotation)) return QUOTATION_EXPIRED_MESSAGE;
  return null;
}
