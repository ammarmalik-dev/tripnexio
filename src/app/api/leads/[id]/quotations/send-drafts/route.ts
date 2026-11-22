import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { checkDraftSend } from "@/lib/quotations/send-draft";
import { applyQuotationSentEffects, notifyQuoteReady } from "@/lib/quotations/send-quotation";
import { dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Client doc 16 Nov (A2) — "send multiple quotations in a single click", Special Fare and Visa Change only. */
const MULTI_SEND_SERVICES = new Set(["FLIGHT_SPECIAL_FARE", "VISA_CHANGE"]);

/**
 * Sends every draft quotation of a lead at once: each draft passes the same checks as a single Send
 * (checkDraftSend), the ready ones go out together, and the customer gets ONE "quotation ready" message whose link
 * lists every option. Drafts that can't go yet are left as drafts and reported back with their reason.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("quotations.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  const ownershipError = await assertOwnsEntity(session, "lead", id);
  if (ownershipError) return ownershipError;

  const lead = await db.lead.findUnique({ where: { id }, include: { customer: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  const actionError = assertServiceAction(session, lead.serviceType, "CREATE_QUOTATION");
  if (actionError) return actionError;
  if (!MULTI_SEND_SERVICES.has(lead.serviceType)) return jsonError(409, "Sending several quotations at once is only for Special Fare and Visa Change.");

  const drafts = await db.quotation.findMany({ where: { leadId: id, isDraft: true, isExpired: false }, orderBy: { createdAt: "asc" } });
  if (drafts.length === 0) return jsonError(409, "There are no draft quotations to send.");

  const ready: { id: string; validityExpiresAt: Date | null }[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const draft of drafts) {
    const check = await checkDraftSend(draft, lead);
    if (check.ok) ready.push({ id: draft.id, validityExpiresAt: check.validityExpiresAt });
    else skipped.push({ id: draft.id, reason: check.message });
  }
  if (ready.length === 0) return jsonError(409, skipped[0]?.reason ?? "None of the drafts can be sent yet.", { skipped: skipped.map((item) => item.reason) });

  const statusNotifications: (StatusNotification | null)[] = [];
  const sent = await db.$transaction(async (tx) => {
    const updated = [];
    for (const item of ready) {
      updated.push(await tx.quotation.update({ where: { id: item.id }, data: { isDraft: false, sentAt: new Date(), validityExpiresAt: item.validityExpiresAt } }));
      await writeAudit(tx, {
        entityType: "Quotation",
        entityId: item.id,
        action: "SEND",
        byUserId: session.id,
        note: `Draft quotation sent to the customer with ${ready.length - 1} other option(s) in one click for lead ${id}${item.validityExpiresAt ? ` — valid until ${item.validityExpiresAt.toISOString()}` : ""} (by ${session.name})`,
      });
    }
    statusNotifications.push(await applyQuotationSentEffects(tx, lead, { byUserId: session.id, name: session.name }));
    return updated;
  });

  await dispatchStatusNotifications(statusNotifications);
  // One message for all of them: the review link shows every option on the lead.
  await notifyQuoteReady(lead, sent[0]);

  return jsonSuccess({ sent: sent.length, skipped });
}
