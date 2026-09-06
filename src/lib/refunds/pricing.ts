import type { ServiceType } from "../../generated/prisma/enums";

/**
 * OTB's actual refund policy figure was never specified beyond "apply the
 * fixed service charge after validation" — per CLAUDE.md hard rule #1, this
 * is a clearly-labeled SAMPLE placeholder, not a real business figure.
 * Replace with the real amount once the client confirms it, and propose it
 * for review rather than seeding a different guess.
 */
export const SAMPLE_OTB_FIXED_SERVICE_CHARGE = 500;

interface RefundInput {
  paidAmount: number;
  cancellationCharge: number;
  gatewayCharge: number;
  /** Only meaningful for OTB bookings — see computeRefundAmount. */
  otbValidated?: boolean;
}

export function isOtbBooking(serviceType: ServiceType): boolean {
  return serviceType === "OTB";
}

/**
 * refundAmount = paidAmount - cancellationCharge - gatewayCharge, with an
 * additional SAMPLE_OTB_FIXED_SERVICE_CHARGE deduction for OTB bookings once
 * the OTB request has already been validated with the airline (staff-
 * confirmed via the `otbValidated` flag — there's no automated way to know
 * this from the data model). Clamped at 0: a refund can't go negative.
 */
export function computeRefundAmount(serviceType: ServiceType, input: RefundInput): number {
  const otbCharge = isOtbBooking(serviceType) && input.otbValidated ? SAMPLE_OTB_FIXED_SERVICE_CHARGE : 0;
  const raw = input.paidAmount - input.cancellationCharge - input.gatewayCharge - otbCharge;
  return Math.max(0, raw);
}
