import { db } from "../db";
import { formatLeadReference } from "../leads/reference";

export interface DocumentRecipient {
  email: string | null;
  customerName: string;
  /** Empty when the document is only linked to a passenger, not a booking — there's no Lead FK on Passenger/Document to derive one from in that case. */
  leadReference: string;
}

/**
 * Resolves who to email about a Document — via its Booking (booking -> lead
 * -> customer) when one is set, otherwise via its Passenger (passenger ->
 * customer). Shared by the DOCUMENTS_REQUIRED/DOCUMENT_APPROVED/
 * DOCUMENT_REJECTED triggers so both document routes resolve this the same way.
 */
export async function resolveDocumentRecipient(document: {
  bookingId: string | null;
  passengerId: string | null;
}): Promise<DocumentRecipient | null> {
  if (document.bookingId) {
    const booking = await db.booking.findUnique({
      where: { id: document.bookingId },
      include: { customer: true, lead: true },
    });
    if (!booking) return null;
    return {
      email: booking.customer.email,
      customerName: booking.customer.name,
      leadReference: formatLeadReference(booking.lead.serviceType, booking.leadId),
    };
  }

  if (document.passengerId) {
    const passenger = await db.passenger.findUnique({
      where: { id: document.passengerId },
      include: { customer: true },
    });
    if (!passenger) return null;
    return { email: passenger.customer.email, customerName: passenger.customer.name, leadReference: "" };
  }

  return null;
}
