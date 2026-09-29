import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { sendQuotationSchema } from "@/lib/validation/quotation-schema";
import { assertValidityWithinCap } from "@/lib/quotations/validity-cap";
import { extensionQuoteBlockReason } from "@/lib/visa-extension/rules";
import { visaChangeQuoteBlockReason } from "@/lib/visa-change/operational";
import { applyQuotationSentEffects, notifyQuoteReady } from "@/lib/quotations/send-quotation";
import { dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * P22 item 7 — sends a draft quotation: isDraft=false, sentAt=now, and the
 * exact same side effects a create-and-send POST /api/quotations fires
 * (shared via src/lib/quotations/send-quotation.ts): lead status move,
 * status-engine QUOTATION_CREATED event, new-quote-request resolution,
 * and the customer QUOTE_READY notification.
 *
 * Validity clock: the body may carry a fresh `validityExpiresAt` (same
 * Admin cap as create). Without one, the draft's own validity is kept —
 * but if it has already passed, or the draft was closed because another
 * quote on the lead was selected, the send is refused so a customer is
 * never notified about a quote that is dead on arrival.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("quotations.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = sendQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const quotation = await db.quotation.findUnique({ where: { id }, include: { lead: { include: { customer: true } } } });
  if (!quotation) return jsonError(404, "Quotation not found.");
  const { lead } = quotation;
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;

  if (!quotation.isDraft) return jsonError(409, "This quotation has already been sent.");
  if (quotation.isExpired) {
    return jsonError(409, "This draft was closed (another quotation was selected, or it expired). Build a new quote instead.");
  }

  // Same lead-level gates as creating a quote — the lead may have changed since the draft was saved.
  const extensionBlock = extensionQuoteBlockReason(lead.serviceType, lead.details);
  if (extensionBlock) return jsonError(409, extensionBlock);
  const visaChangeBlock = visaChangeQuoteBlockReason(lead.serviceType, lead.details);
  if (visaChangeBlock) return jsonError(409, visaChangeBlock);

  let validityExpiresAt = quotation.validityExpiresAt;
  if (parsed.data.validityExpiresAt) {
    const capError = await assertValidityWithinCap(lead.serviceType, parsed.data.validityExpiresAt);
    if (capError) return jsonError(400, capError, { validityExpiresAt: [capError] });
    validityExpiresAt = new Date(parsed.data.validityExpiresAt);
  }
  if (validityExpiresAt && validityExpiresAt.getTime() <= Date.now()) {
    const message = "This draft's validity has already passed — set a new validity before sending.";
    return jsonError(409, message, { validityExpiresAt: [message] });
  }

  const statusNotifications: (StatusNotification | null)[] = [];
  const sent = await db.$transaction(async (tx) => {
    const updated = await tx.quotation.update({
      where: { id },
      data: { isDraft: false, sentAt: new Date(), validityExpiresAt },
    });
    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: id,
      action: "SEND",
      byUserId: session.id,
      note: `Draft quotation sent to the customer for lead ${lead.id}${validityExpiresAt ? ` — valid until ${validityExpiresAt.toISOString()}` : ""} (by ${session.name})`,
    });
    statusNotifications.push(await applyQuotationSentEffects(tx, lead, { byUserId: session.id, name: session.name }));
    return updated;
  });

  await dispatchStatusNotifications(statusNotifications);
  await notifyQuoteReady(lead, sent);

  return jsonSuccess(sent);
}
