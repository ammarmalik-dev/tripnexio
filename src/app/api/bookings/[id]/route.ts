import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { formatLeadReference } from "@/lib/leads/reference";
import { syncExpiredReservations } from "@/lib/bookings/reservation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;

  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      payments: { include: { refunds: true }, orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      lead: { include: { quotations: { where: { isSelected: true } } } },
      customer: { include: { passengers: true } },
      // CRM.md §12 (Step 14) — this booking's own passengers, each with an
      // independently visible status, distinct from customer.passengers
      // below (that stays the full Customer-360 history across every
      // lead/booking, same split LeadDetail.tsx already uses).
      passengers: { include: { passenger: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) return jsonError(404, "Booking not found.");

  // Return_Verified_Ticket.md §7: "Staff should be able to see the internal
  // expiry information" — synced here (not just wherever a future issue
  // action might live) per feedback_audit_all_readers_of_lazily_synced_state.
  const [synced] = await syncExpiredReservations([booking]);

  return jsonSuccess({
    id: synced.id,
    bookingId: synced.bookingId,
    status: synced.status,
    createdAt: synced.createdAt,
    reservationIssuedAt: synced.reservationIssuedAt,
    reservationExpiresAt: synced.reservationExpiresAt,
    reservationExpired: synced.reservationExpired,
    leadId: booking.leadId,
    leadReferenceId: formatLeadReference(booking.lead.serviceType, booking.leadId),
    serviceType: booking.lead.serviceType,
    selectedQuotation: booking.lead.quotations[0] ?? null,
    customer: {
      id: booking.customer.id,
      name: booking.customer.name,
      mobile: booking.customer.mobile,
      email: booking.customer.email,
      passengers: booking.customer.passengers.map((passenger) => ({
        id: passenger.id,
        fullName: passenger.fullName,
        paxType: passenger.paxType,
      })),
    },
    // Documents aren't duplicated onto each passenger here — the client
    // derives "this passenger's documents" by filtering the flat
    // `documents` array below by `passengerId`, so there's exactly one
    // place a document's status ever lives, not two copies to keep in sync.
    passengers: booking.passengers.map((bookingPassenger) => ({
      id: bookingPassenger.passenger.id,
      fullName: bookingPassenger.passenger.fullName,
      paxType: bookingPassenger.passenger.paxType,
      status: bookingPassenger.status,
    })),
    payments: booking.payments,
    documents: booking.documents,
  });
}
