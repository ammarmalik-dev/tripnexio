import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { getLeadRelatedEntityRefs } from "@/lib/leads/related-entities";
import { findPriorTripNexioVisaByPassport } from "@/lib/leads/visa-extension-eligibility";

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

  // Visa Extension handover doc: staff see, per applicant, whether that
  // passport number already has a visa issued through TripNexio.
  const priorVisaMatches =
    lead.serviceType === "VISA_EXTENSION"
      ? await Promise.all(
          leadPassengers
            .filter((passenger) => passenger.passportNumber)
            .map(async (passenger) => {
              const match = await findPriorTripNexioVisaByPassport(passenger.passportNumber as string);
              return {
                passengerId: passenger.id,
                fullName: passenger.fullName,
                passportNumber: passenger.passportNumber as string,
                match: match
                  ? { ...match, referenceId: formatLeadReference("NEW_VISA", match.leadId) }
                  : null,
              };
            })
        )
      : [];

  const entityRefs = await getLeadRelatedEntityRefs(id);

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
    temperature: lead.temperature,
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
    priorVisaMatches,
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
