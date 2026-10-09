import { db } from "../db";
import { syncExpiredQuotations } from "../quotations/sync-expiry";

export interface EntityRef {
  entityType: string;
  entityId: string;
}

/**
 * Every entity that "belongs to" a Lead for AuditTrail-aggregation purposes
 * — the Lead itself, its Quotations, its Bookings, those Bookings'
 * Payments, and every Document attached to either a Booking or one of the
 * lead's own passengers. Extracted from GET /api/leads/[id]'s original
 * inline timeline query (Phase 3B) so the Communications module (Step 18,
 * audit §3.7) can reuse the exact same "what belongs to this lead" scope
 * to filter EMAIL_SENT/EMAIL_SKIPPED/EMAIL_FAILED rows, instead of
 * re-deriving it.
 */
export async function getLeadRelatedEntityRefs(leadId: string): Promise<EntityRef[]> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      quotations: true,
      bookings: { include: { payments: true } },
    },
  });
  if (!lead) return [];

  const quotations = await syncExpiredQuotations(lead.quotations);

  const details = (lead.details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(details.passengerIds) ? (details.passengerIds as string[]) : [];
  const bookingIds = lead.bookings.map((booking) => booking.id);

  // Client testing 2026-10-09 (E6) — only this request's documents: its bookings'
  // documents, and the passengers' documents added since this lead was created
  // without another booking (a passenger's older requests stay in their own records).
  const relatedDocuments = await db.document.findMany({
    where: {
      OR: [
        bookingIds.length ? { bookingId: { in: bookingIds } } : undefined,
        passengerIds.length ? { passengerId: { in: passengerIds }, bookingId: null, createdAt: { gte: lead.createdAt } } : undefined,
      ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause)),
    },
  });

  return [
    { entityType: "Lead", entityId: lead.id },
    ...quotations.map((quotation) => ({ entityType: "Quotation", entityId: quotation.id })),
    ...lead.bookings.map((booking) => ({ entityType: "Booking", entityId: booking.id })),
    ...lead.bookings.flatMap((booking) => booking.payments.map((payment) => ({ entityType: "Payment", entityId: payment.id }))),
    ...relatedDocuments.map((document) => ({ entityType: "Document", entityId: document.id })),
  ];
}
