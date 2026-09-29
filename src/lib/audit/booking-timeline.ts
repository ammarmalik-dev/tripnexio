import { db } from "../db";
import { getAuditTimeline, type AuditEntityRef, type AuditTimeline } from "./timeline";

export interface BookingTimelineSource {
  id: string;
  leadId: string;
  payments: { id: string; refunds: { id: string }[] }[];
  documents: { id: string }[];
  protectionPlans?: { id: string }[];
}

/**
 * CRM.md §36 — a booking's full activity: the booking itself, its lead, every
 * quotation on that lead, its payments and their refunds, its documents (and
 * protection plans, where any). Takes the booking row GET /api/bookings/[id]
 * already loaded, so the only extra work is one small quotation-id lookup
 * plus the capped AuditTrail query — no more nested includes on the main
 * booking query.
 */
export async function getBookingTimeline(booking: BookingTimelineSource, limit?: number): Promise<AuditTimeline> {
  const quotations = await db.quotation.findMany({ where: { leadId: booking.leadId }, select: { id: true } });

  const refs: AuditEntityRef[] = [
    { entityType: "Booking", entityId: booking.id },
    { entityType: "Lead", entityId: booking.leadId },
    ...quotations.map((quotation) => ({ entityType: "Quotation", entityId: quotation.id })),
    ...booking.payments.map((payment) => ({ entityType: "Payment", entityId: payment.id })),
    ...booking.payments.flatMap((payment) => payment.refunds.map((refund) => ({ entityType: "Refund", entityId: refund.id }))),
    ...booking.documents.map((document) => ({ entityType: "Document", entityId: document.id })),
    ...(booking.protectionPlans ?? []).map((plan) => ({ entityType: "ProtectionPlan", entityId: plan.id })),
  ];

  return getAuditTimeline(refs, limit);
}
