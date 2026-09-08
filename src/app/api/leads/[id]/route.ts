import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          passengers: { include: { documents: true } },
          leads: { orderBy: { createdAt: "desc" } },
          bookings: { orderBy: { createdAt: "desc" } },
        },
      },
      assignedStaff: true,
      quotations: { orderBy: { createdAt: "desc" } },
      bookings: { include: { payments: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) return jsonError(404, "Lead not found.");

  const quotations = await syncExpiredQuotations(lead.quotations);

  const details = (lead.details ?? {}) as Record<string, unknown>;
  const passengerIds = Array.isArray(details.passengerIds) ? (details.passengerIds as string[]) : [];
  const leadPassengers = lead.customer.passengers.filter((passenger) => passengerIds.includes(passenger.id));

  const bookingIds = lead.bookings.map((booking) => booking.id);
  const relatedDocuments = await db.document.findMany({
    where: {
      OR: [
        bookingIds.length ? { bookingId: { in: bookingIds } } : undefined,
        passengerIds.length ? { passengerId: { in: passengerIds } } : undefined,
      ].filter((clause): clause is NonNullable<typeof clause> => Boolean(clause)),
    },
  });

  const entityRefs: { entityType: string; entityId: string }[] = [
    { entityType: "Lead", entityId: lead.id },
    ...quotations.map((quotation) => ({ entityType: "Quotation", entityId: quotation.id })),
    ...lead.bookings.map((booking) => ({ entityType: "Booking", entityId: booking.id })),
    ...lead.bookings.flatMap((booking) =>
      booking.payments.map((payment) => ({ entityType: "Payment", entityId: payment.id }))
    ),
    ...relatedDocuments.map((document) => ({ entityType: "Document", entityId: document.id })),
  ];

  const timeline =
    entityRefs.length > 0
      ? await db.auditTrail.findMany({
          where: { OR: entityRefs },
          include: { byUser: true },
          orderBy: { timestamp: "asc" },
        })
      : [];

  return jsonSuccess({
    id: lead.id,
    referenceId: formatLeadReference(lead.serviceType, lead.id),
    serviceType: lead.serviceType,
    status: lead.status,
    source: lead.source,
    details: lead.details,
    createdAt: lead.createdAt,
    assignedStaff: lead.assignedStaff
      ? { id: lead.assignedStaff.id, name: lead.assignedStaff.name, email: lead.assignedStaff.email }
      : null,
    customer: {
      id: lead.customer.id,
      name: lead.customer.name,
      mobile: lead.customer.mobile,
      email: lead.customer.email,
      createdAt: lead.customer.createdAt,
      passengers: lead.customer.passengers.map((passenger) => ({
        id: passenger.id,
        fullName: passenger.fullName,
        paxType: passenger.paxType,
        nationality: passenger.nationality,
        passportNumber: passenger.passportNumber,
      })),
      otherLeads: lead.customer.leads
        .filter((otherLead) => otherLead.id !== lead.id)
        .map((otherLead) => ({
          id: otherLead.id,
          referenceId: formatLeadReference(otherLead.serviceType, otherLead.id),
          serviceType: otherLead.serviceType,
          status: otherLead.status,
          createdAt: otherLead.createdAt,
        })),
      otherBookings: lead.customer.bookings
        .filter((booking) => booking.leadId !== lead.id)
        .map((booking) => ({
          id: booking.id,
          bookingId: booking.bookingId,
          status: booking.status,
          createdAt: booking.createdAt,
        })),
    },
    passengers: leadPassengers.map((passenger) => ({
      id: passenger.id,
      fullName: passenger.fullName,
      paxType: passenger.paxType,
      nationality: passenger.nationality,
      passportNumber: passenger.passportNumber,
      documents: passenger.documents.map((document) => ({
        id: document.id,
        type: document.type,
        status: document.status,
        fileUrl: document.fileUrl,
      })),
    })),
    quotations,
    bookings: lead.bookings,
    timeline: timeline.map((entry) => ({
      id: entry.id,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      note: entry.note,
      timestamp: entry.timestamp,
      byUser: entry.byUser ? { name: entry.byUser.name } : null,
    })),
  });
}
