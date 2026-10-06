import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { runSequentially } from "@/lib/db-sequential";
import { requirePermission } from "@/lib/auth/require-permission";
import { leadReference } from "@/lib/leads/reference";
import { maskPhoneNumber } from "@/lib/admin/monitoring";
import { maskRecipient } from "@/lib/logging/mask";
import type { WhatsAppMessageDirection } from "@/generated/prisma/enums";

const LIST_SIZE = 20;
const MESSAGE_PREVIEW_LENGTH = 140;

/**
 * P24 item 8 — Admin → Live Activity: the 20 most recent leads, payments,
 * bookings, WhatsApp conversations, OCR jobs and emails, polled by the page every
 * 30 seconds. Each list is one small, flat, `take: 20` query (plus one
 * extra lookup for each conversation's latest message) — no deep includes.
 * WhatsApp numbers are masked server-side; the raw number never leaves the
 * API. Gated by `automation.view` (live system monitoring).
 */
export async function GET() {
  const auth = await requirePermission("automation.view");
  if (auth.error) return auth.error;

  try {
    const [leads, payments, bookings, conversations, ocrJobs, emails] = await runSequentially([
      () => (db.lead.findMany({
        orderBy: { createdAt: "desc" },
        take: LIST_SIZE,
        select: { id: true, reference: true, serviceType: true, status: true, source: true, createdAt: true, customer: { select: { name: true } } },
      })),
      () => (db.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: LIST_SIZE,
        select: {
          id: true,
          status: true,
          method: true,
          amount: true,
          gstAmount: true,
          gatewayFee: true,
          couponDiscount: true,
          createdAt: true,
          booking: { select: { id: true, bookingId: true } },
        },
      })),
      // Client corrections 2026-10-05: an unpaid booking stays with its Lead, so it isn't listed again here.
      () => (db.booking.findMany({
        where: { status: { not: "PENDING" } },
        orderBy: { createdAt: "desc" },
        take: LIST_SIZE,
        select: { id: true, bookingId: true, status: true, createdAt: true, lead: { select: { serviceType: true } }, customer: { select: { name: true } } },
      })),
      () => (db.whatsAppConversation.findMany({
        orderBy: { updatedAt: "desc" },
        take: LIST_SIZE,
        select: { id: true, waId: true, customerName: true, state: true, serviceType: true, leadId: true, updatedAt: true },
      })),
      () => (db.documentExtraction.findMany({
        orderBy: { createdAt: "desc" },
        take: LIST_SIZE,
        select: { id: true, extractionType: true, status: true, provider: true, mrzValid: true, bookingId: true, createdAt: true },
      })),
      // Client corrections 2026-10-05 — Email activity: the per-send audit rows notifyCustomer() writes (recipient masked below).
      () => (db.auditTrail.findMany({
        where: { action: { in: ["EMAIL_SENT", "EMAIL_FAILED", "EMAIL_SKIPPED"] } },
        orderBy: { timestamp: "desc" },
        take: LIST_SIZE,
        select: { id: true, action: true, entityType: true, entityId: true, note: true, timestamp: true },
      }))]);

    const waIds = conversations.map((conversation) => conversation.waId);
    // One DISTINCT ON query for the newest message per conversation —
    // avoids pulling every message of a chatty conversation into memory.
    const latestMessages = waIds.length
      ? await db.$queryRaw<{ waId: string; direction: WhatsAppMessageDirection; body: string; createdAt: Date }[]>`
          SELECT DISTINCT ON ("waId") "waId", "direction"::text AS direction, "body", "createdAt"
          FROM "WhatsAppMessageLog"
          WHERE "waId" = ANY(${waIds}::text[])
          ORDER BY "waId", "createdAt" DESC`
      : [];
    const latestByWaId = new Map(latestMessages.map((message) => [message.waId, message]));

    return jsonSuccess({
      generatedAt: new Date(),
      leads: leads.map((lead) => ({
        id: lead.id,
        reference: leadReference(lead),
        serviceType: lead.serviceType,
        status: lead.status,
        source: lead.source,
        customerName: lead.customer.name,
        createdAt: lead.createdAt,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        method: payment.method,
        total:
          Math.round(
            (Number(payment.amount) - Number(payment.couponDiscount ?? 0) + Number(payment.gstAmount) + Number(payment.gatewayFee)) * 100
          ) / 100,
        createdAt: payment.createdAt,
        booking: payment.booking,
      })),
      bookings: bookings.map((booking) => ({
        id: booking.id,
        bookingId: booking.bookingId,
        status: booking.status,
        serviceType: booking.lead.serviceType,
        customerName: booking.customer.name,
        createdAt: booking.createdAt,
      })),
      conversations: conversations.map((conversation) => {
        const message = latestByWaId.get(conversation.waId);
        const body = message?.body ?? null;
        return {
          id: conversation.id,
          maskedNumber: maskPhoneNumber(conversation.waId),
          customerName: conversation.customerName,
          state: conversation.state,
          serviceType: conversation.serviceType,
          leadId: conversation.leadId,
          updatedAt: conversation.updatedAt,
          latestMessage: message
            ? {
                direction: message.direction,
                preview: body && body.length > MESSAGE_PREVIEW_LENGTH ? `${body.slice(0, MESSAGE_PREVIEW_LENGTH - 1)}…` : body,
                createdAt: message.createdAt,
              }
            : null,
        };
      }),
      ocrJobs,
      emails: emails.map((email) => ({ ...email, note: email.note?.replace(/[^\s@]+@[^\s@]+\.[^\s@)]+/g, (address) => maskRecipient(address)) ?? null })),
    });
  } catch (error) {
    console.error("[api/admin/live-activity]", error);
    return jsonError(500, "Couldn't load live activity. Please try again.");
  }
}
