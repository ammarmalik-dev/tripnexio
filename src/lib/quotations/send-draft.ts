import type { Lead, Quotation } from "../../generated/prisma/client";
import { assertValidityWithinCap, effectiveQuoteValidity } from "./validity-cap";
import { draftSendValidity } from "./send-validity";
import { extensionQuoteBlockReason } from "../visa-extension/rules";
import { isAirportToAirportLead, parseOperationalBlock, visaChangeQuoteBlockReason } from "../visa-change/operational";

export type DraftSendCheck = { ok: true; validityExpiresAt: Date | null } | { ok: false; status: number; message: string; field?: "validityExpiresAt" };

/**
 * The gates a draft quotation passes before it goes to the customer (P22 item 7), shared by the single Send and
 * client doc 16 Nov (A2) "send every draft in one click": still a draft, not closed, lead-level rules, the Visa
 * Change option's own border / flights, and a validity inside the Admin cap that hasn't already passed.
 */
export async function checkDraftSend(
  quotation: Pick<Quotation, "isDraft" | "isExpired" | "operationalBlock" | "validityExpiresAt">,
  lead: Pick<Lead, "serviceType" | "details" | "countryId">,
  explicitValidity?: string | null
): Promise<DraftSendCheck> {
  if (!quotation.isDraft) return { ok: false, status: 409, message: "This quotation has already been sent." };
  if (quotation.isExpired) {
    return { ok: false, status: 409, message: "This draft was closed (another quotation was selected, or it expired). Build a new quote instead." };
  }
  const extensionBlock = extensionQuoteBlockReason(lead.serviceType, lead.details);
  if (extensionBlock) return { ok: false, status: 409, message: extensionBlock };
  const visaChangeBlock = visaChangeQuoteBlockReason(lead.serviceType, lead.details);
  if (visaChangeBlock) return { ok: false, status: 409, message: visaChangeBlock };
  // B32 / client doc 2026-10-20 (D8) — a Visa Change option carries its own border or flights.
  if (lead.serviceType === "VISA_CHANGE" && !isAirportToAirportLead(lead.serviceType, lead.details) && parseOperationalBlock(quotation.operationalBlock)?.kind !== "BORDER") {
    return { ok: false, status: 409, message: "Select the border (non-UAE side) for this option before sending it." };
  }
  if (isAirportToAirportLead(lead.serviceType, lead.details) && parseOperationalBlock(quotation.operationalBlock)?.kind !== "A2A") {
    return { ok: false, status: 409, message: "Add the exit and re-entry flights to this option before sending it." };
  }
  if (explicitValidity) {
    const capError = await assertValidityWithinCap(lead.serviceType, explicitValidity, lead.countryId);
    if (capError) return { ok: false, status: 400, message: capError, field: "validityExpiresAt" };
  }
  // A flight draft saved without a validity goes out with the full window (client 2026-10-23 audit); client doc
  // 2026-10-27 (A6) — so does one whose saved validity already passed while it sat as a draft.
  const fallback = await effectiveQuoteValidity(lead.serviceType, undefined, lead.countryId);
  const validityExpiresAt = draftSendValidity({
    explicit: explicitValidity ? new Date(explicitValidity) : null,
    stored: quotation.validityExpiresAt,
    fallback: fallback ? new Date(fallback) : null,
    now: new Date(),
  });
  if (validityExpiresAt && validityExpiresAt.getTime() <= Date.now()) {
    return { ok: false, status: 409, message: "This draft's validity has already passed — set a new validity before sending.", field: "validityExpiresAt" };
  }
  return { ok: true, validityExpiresAt };
}
