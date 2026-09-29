import { db } from "../db";
import { writeAudit } from "../audit/log";
import { resolveNewQuoteRequest } from "./new-quote-request";
import { isExpiredNow } from "./sync-expiry";
import { assertValidityWithinCap } from "./validity-cap";

export interface RevalidateActor {
  byUserId?: string;
  /** e.g. "by Sample Admin" — appended to the audit note. */
  label: string;
}

/**
 * Business Rules §9 ("Existing Unpaid Quotes" → "Staff revalidation"): if the
 * same fare/terms are still valid, staff can explicitly revalidate an
 * EXPIRED quote to a new validity period, re-enabling the same payment link
 * (the customer's /quote/[token] page already re-includes any quotation
 * where !isExpiredNow — see load-quote-review.ts — so simply clearing
 * isExpired here is what "re-enables" it, no separate link to regenerate).
 * If the fare is no longer available, the doc says the old quote stays
 * expired and a new quote is required — that's just "don't call this",
 * nothing to implement.
 *
 * This is a Sensitive Admin Action (§14 — "change important workflow/status
 * configuration") — the required reason is the "Extra Confirmation" the
 * locked doc calls for, and is folded into the audit note per §14's
 * required fields (old value / new value / reason / admin / lead-booking id).
 */
export async function revalidateQuotation(
  quotationId: string,
  input: { validityExpiresAt: string; reason: string },
  actor: RevalidateActor
) {
  const quotation = await db.quotation.findUnique({ where: { id: quotationId }, include: { lead: true } });
  if (!quotation) return { ok: false as const, error: "Quotation not found." };
  // P22 — a draft isn't live, so there's nothing to revalidate; edit it and send it instead.
  if (quotation.isDraft) {
    return { ok: false as const, error: "This quotation is still a draft — edit its validity and send it instead." };
  }
  if (!isExpiredNow(quotation)) {
    return { ok: false as const, error: "Only an expired quotation can be revalidated." };
  }

  const validityError = await assertValidityWithinCap(quotation.lead.serviceType, input.validityExpiresAt);
  if (validityError) return { ok: false as const, error: validityError };

  const newValidity = new Date(input.validityExpiresAt);
  if (newValidity.getTime() <= Date.now()) {
    return { ok: false as const, error: "New validity must be in the future." };
  }

  const oldValidity = quotation.validityExpiresAt ? quotation.validityExpiresAt.toISOString() : "none";

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.quotation.update({
      where: { id: quotationId },
      data: { isExpired: false, validityExpiresAt: newValidity },
    });
    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: quotationId,
      action: "REVALIDATE",
      byUserId: actor.byUserId,
      note: `Revalidated for lead ${quotation.leadId} (${actor.label}) — validity ${oldValidity} -> ${newValidity.toISOString()}. Reason: ${input.reason}`,
    });
    // P15 — answers a customer's "Request New Quote".
    await resolveNewQuoteRequest(tx, quotation.leadId, `Quote revalidated (${actor.label})`);
    return result;
  });

  return { ok: true as const, quotation: updated };
}
