import { db } from "../db";
import { customerStatusLabel } from "../service-status/customer-label";
import { customerProtectionPlanLabel, passengerVisaStatus } from "./passenger-status";

export interface CustomerPassengerStatus {
  name: string;
  visaStatus: string;
  /** Null when the customer didn't choose Protection Plan for this passenger. */
  protectionPlan: string | null;
}

/**
 * P12 — for a New Visa booking, each passenger's visa status next to their
 * Protection Plan status, in customer wording (for /account and Track
 * Status). `maskName` is applied on the public Track page. Empty for any
 * other service.
 */
export async function customerPassengerStatuses(bookingId: string, maskName?: (name: string) => string): Promise<CustomerPassengerStatus[]> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      visaRejectionReason: true,
      lead: { select: { serviceType: true } },
      serviceStatus: { select: { customerLabel: true } },
      passengers: { orderBy: { createdAt: "asc" }, select: { passenger: { select: { id: true, fullName: true } } } },
      protectionPlans: { select: { passengerId: true, status: true } },
      documents: { where: { type: "VISA_PDF" }, select: { passengerId: true, type: true, deliveredAt: true } },
    },
  });
  if (!booking || booking.lead.serviceType !== "NEW_VISA") return [];

  const bookingStatusLabel = customerStatusLabel("BOOKING", booking.serviceStatus, booking.status);
  return booking.passengers.map(({ passenger }) => ({
    name: maskName ? maskName(passenger.fullName) : passenger.fullName,
    visaStatus: passengerVisaStatus({
      passengerId: passenger.id,
      visaRejected: Boolean(booking.visaRejectionReason),
      bookingStatusLabel,
      documents: booking.documents,
    }),
    protectionPlan: customerProtectionPlanLabel(booking.protectionPlans.find((plan) => plan.passengerId === passenger.id)?.status),
  }));
}
