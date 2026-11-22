import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { sendQuotationSchema } from "@/lib/validation/quotation-schema";
import { applyQuotationSentEffects, notifyQuoteReady } from "@/lib/quotations/send-quotation";
import { checkDraftSend } from "@/lib/quotations/send-draft";
import { dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

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
  // Client doc 2026-10-15 (C6) — only the record's own staff (or a manager / Admin) can act on it.
  const ownershipError = await assertOwnsEntity(auth.session, "quotation", id);
  if (ownershipError) return ownershipError;

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
  const actionError = assertServiceAction(session, lead.serviceType, "CREATE_QUOTATION");
  if (actionError) return actionError;

  const check = await checkDraftSend(quotation, lead, parsed.data.validityExpiresAt);
  if (!check.ok) return jsonError(check.status, check.message, check.field ? { [check.field]: [check.message] } : undefined);
  const { validityExpiresAt } = check;

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
