import type { ProtectionPlanStatus } from "../../generated/prisma/enums";

/**
 * P12 — customer-safe Protection Plan wording for /account and Track Status.
 * A plan the customer never chose (NOT_OFFERED / OFFERED) is not shown at all.
 */
export const CUSTOMER_PROTECTION_PLAN_LABELS: Partial<Record<ProtectionPlanStatus, string>> = {
  SELECTED_TERMS_PENDING: "Awaiting terms",
  TERMS_ACCEPTED: "Awaiting payment",
  PURCHASED: "Active",
  UNDER_ELIGIBILITY_REVIEW: "Under review",
  ELIGIBLE: "Active",
  INELIGIBLE: "Not eligible",
  CANCELLED: "Cancelled",
  REFUND_UNDER_REVIEW: "Refund under review",
  REFUND_APPROVED: "Refund approved",
  REFUND_PROCESSING: "Refund in progress",
  REFUND_REJECTED: "Refund not approved",
  REFUND_COMPLETED: "Refunded",
};

export function customerProtectionPlanLabel(status: ProtectionPlanStatus | null | undefined): string | null {
  return status ? (CUSTOMER_PROTECTION_PLAN_LABELS[status] ?? null) : null;
}

/**
 * One passenger's visa status on a New Visa booking, for the side-by-side
 * Visa / Protection Plan view: Rejected when the embassy rejected the
 * application, Visa delivered / Visa issued once that passenger's visa PDF
 * exists, otherwise the booking's current (customer-safe) status.
 */
export function passengerVisaStatus(input: {
  passengerId: string;
  visaRejected: boolean;
  bookingStatusLabel: string;
  documents: { passengerId: string | null; type: string; deliveredAt: Date | string | null }[];
}): string {
  if (input.visaRejected) return "Rejected";
  const visa = input.documents.find((doc) => doc.passengerId === input.passengerId && doc.type === "VISA_PDF");
  if (visa?.deliveredAt) return "Visa delivered";
  if (visa) return "Visa issued";
  return input.bookingStatusLabel;
}
