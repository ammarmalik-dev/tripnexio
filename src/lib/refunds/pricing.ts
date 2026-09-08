import type { ServiceType } from "../../generated/prisma/enums";

/**
 * OTB's post-validation refund deduction, confirmed against the client's
 * locked spec (`client-message/OTB.md`): "after documents validated: deduct
 * ₹250 service charge + gateway charges." No longer a placeholder.
 */
export const OTB_FIXED_SERVICE_CHARGE = 250;

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
 * additional OTB_FIXED_SERVICE_CHARGE deduction for OTB bookings once
 * the OTB request has already been validated with the airline (staff-
 * confirmed via the `otbValidated` flag — there's no automated way to know
 * this from the data model). Clamped at 0: a refund can't go negative.
 */
export function computeRefundAmount(serviceType: ServiceType, input: RefundInput): number {
  const otbCharge = isOtbBooking(serviceType) && input.otbValidated ? OTB_FIXED_SERVICE_CHARGE : 0;
  const raw = input.paidAmount - input.cancellationCharge - input.gatewayCharge - otbCharge;
  return Math.max(0, raw);
}
