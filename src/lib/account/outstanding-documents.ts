import { db } from "../db";
import { formatLeadReference } from "../leads/reference";
import type { ServiceType } from "../../generated/prisma/enums";

export interface OutstandingDocument {
  id: string;
  type: string;
  leadReference: string | null;
  serviceType: ServiceType | null;
  passengerName: string | null;
  bookingDisplayId: string | null;
}

/**
 * Step 55 — every Document a customer still needs to fulfill, across every
 * one of their Leads/Bookings/Passengers, not just Return Ticket/OTB's
 * post-payment checklist (H7). This is the "anything requested after the
 * fact" channel the roadmap's own fallback names — a staff member creates
 * the requirement (`POST /api/documents`, status REQUIRED) against any
 * service, and it shows up here regardless of whether that service has a
 * `/pay/<token>` page at all.
 */
export async function getOutstandingDocuments(customerId: string): Promise<OutstandingDocument[]> {
  const documents = await db.document.findMany({
    where: {
      status: { in: ["REQUIRED", "MISSING"] },
      OR: [{ booking: { customerId } }, { passenger: { customerId } }],
    },
    include: {
      booking: { include: { lead: true } },
      passenger: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return documents.map((document) => ({
    id: document.id,
    type: document.type,
    leadReference: document.booking ? formatLeadReference(document.booking.lead.serviceType, document.booking.leadId) : null,
    serviceType: document.booking?.lead.serviceType ?? null,
    passengerName: document.passenger?.fullName ?? null,
    bookingDisplayId: document.booking?.bookingId ?? null,
  }));
}
