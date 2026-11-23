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

  // Client doc 16 Nov (J4) — separate histories: the lead keeps its own activity, its quotations and the unpaid
  // checkout (a booking that was never paid stays with its lead); a paid booking's activity is on that booking.
  // Only this request's lead-stage documents, never a passenger's other requests (those stay in Customer 360).
  const relatedDocuments = await db.document.findMany({ where: { leadId: lead.id, bookingId: null }, select: { id: true } });
  const unpaidBookings = lead.bookings.filter((booking) => !booking.payments.some((payment) => payment.status === "SUCCESS"));

  return [
    { entityType: "Lead", entityId: lead.id },
    ...quotations.map((quotation) => ({ entityType: "Quotation", entityId: quotation.id })),
    ...unpaidBookings.map((booking) => ({ entityType: "Booking", entityId: booking.id })),
    ...unpaidBookings.flatMap((booking) => booking.payments.map((payment) => ({ entityType: "Payment", entityId: payment.id }))),
    ...relatedDocuments.map((document) => ({ entityType: "Document", entityId: document.id })),
  ];
}

/** Client doc 16 Nov (J4) — one booking's own history: the booking, its payments and refunds, its own documents. */
export async function getBookingEntityRefs(bookingId: string): Promise<EntityRef[]> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, payments: { select: { id: true, refunds: { select: { id: true } } } }, documents: { select: { id: true } }, protectionPlans: { select: { id: true } } },
  });
  if (!booking) return [];
  return [
    { entityType: "Booking", entityId: booking.id },
    ...booking.payments.map((payment) => ({ entityType: "Payment", entityId: payment.id })),
    ...booking.payments.flatMap((payment) => payment.refunds.map((refund) => ({ entityType: "Refund", entityId: refund.id }))),
    ...booking.documents.map((document) => ({ entityType: "Document", entityId: document.id })),
    ...booking.protectionPlans.map((plan) => ({ entityType: "ProtectionPlan", entityId: plan.id })),
  ];
}
