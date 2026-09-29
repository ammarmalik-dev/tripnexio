import type { Customer, Lead, Prisma, Quotation } from "../../generated/prisma/client";
import { writeAudit } from "../audit/log";
import { notifyCustomer } from "../notifications/notify";
import { NOTIFICATION_EVENTS } from "../notifications/events";
import { leadReference } from "../leads/reference";
import { money } from "../invoices/render-invoice";
import { toWhatsAppId } from "../whatsapp/phone";
import { siteConfig } from "../site-config";
import { ensureLeadCustomerToken } from "./select-quotation";
import { resolveNewQuoteRequest } from "./new-quote-request";
import { applySystemEvent, type StatusNotification } from "../service-status/engine";

/**
 * P22 item 7 — the side effects of a quotation becoming visible to the
 * customer ("sent"), shared by:
 *   - POST /api/quotations without `saveAsDraft` (create & send in one go),
 *   - POST /api/quotations/[id]/send (a draft being sent),
 * and — for the notification half only — PATCH /api/quotations/[id] when a
 * sent quotation is revised.
 *
 * A draft never runs any of this, which is exactly what keeps it invisible:
 * no QUOTE_READY notification, no lead status move, no status-engine
 * QUOTATION_CREATED event, no "Request New Quote" resolution.
 */

export interface SendActor {
  byUserId: string;
  name: string;
}

// Only the "not yet quoted" states move forward — never regress a lead
// already further along (accepted/payment-pending/converted), and never
// override Follow-up Required/Lost/Closed... (Step 49 — unchanged rule,
// moved here from POST /api/quotations so the send route reuses it.)
const EARLY_LEAD_STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP_REQUIRED", "CUSTOMER_RESPONDED", "QUALIFIED"];

/** Runs inside the caller's transaction. Returns the status-engine notification to dispatch after commit. */
export async function applyQuotationSentEffects(
  tx: Prisma.TransactionClient,
  lead: Pick<Lead, "id" | "status">,
  actor: SendActor
): Promise<StatusNotification | null> {
  if (EARLY_LEAD_STATUSES.includes(lead.status)) {
    await tx.lead.update({ where: { id: lead.id }, data: { status: "QUOTATION_CREATED" } });
    await writeAudit(tx, {
      entityType: "Lead",
      entityId: lead.id,
      action: "STATUS_CHANGE",
      byUserId: actor.byUserId,
      note: `${lead.status} -> QUOTATION_CREATED (quotation sent by ${actor.name})`,
    });
  }
  const notification = await applySystemEvent(tx, {
    scope: "LEAD",
    entityId: lead.id,
    event: "QUOTATION_CREATED",
    userId: actor.byUserId,
    actorLabel: `by ${actor.name}`,
  });
  // P15 — a new (sent) quote answers a customer's "Request New Quote".
  await resolveNewQuoteRequest(tx, lead.id, `New quotation sent (by ${actor.name})`);
  return notification;
}

/**
 * The customer-facing QUOTE_READY notification (email/WhatsApp/SMS) with the
 * quote-review link. Call only after the transaction that made the quotation
 * visible has committed.
 */
export async function notifyQuoteReady(
  lead: Lead & { customer: Customer },
  quotation: Pick<Quotation, "id" | "sellingPrice" | "couponDiscount" | "validityExpiresAt">
): Promise<void> {
  const payable = Number(quotation.sellingPrice) - Number(quotation.couponDiscount ?? 0);
  const reviewToken = await ensureLeadCustomerToken(lead);
  await notifyCustomer({
    event: NOTIFICATION_EVENTS.QUOTE_READY,
    emailTo: lead.customer.email,
    whatsappTo: toWhatsAppId(lead.customer.mobile),
    smsTo: toWhatsAppId(lead.customer.mobile),
    variables: {
      customerName: lead.customer.name,
      leadReference: leadReference(lead),
      sellingPrice: money(payable),
      quoteValidUntil: quotation.validityExpiresAt
        ? quotation.validityExpiresAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : "no expiry set",
      reviewLink: `${siteConfig.url}/quote/${reviewToken}`,
    },
    auditTarget: { entityType: "Quotation", entityId: quotation.id },
  });
}
