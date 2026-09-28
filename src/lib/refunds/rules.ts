import type { BookingStatus, ExtensionOutcome, ServiceType } from "../../generated/prisma/enums";
import type { RefundConfigValues } from "./config";

/**
 * Per-service refund rules on top of computeRefundAmount's generic arithmetic
 * (src/lib/refunds/pricing.ts). The amounts, time window and cutoff come from
 * the Admin-managed RefundConfig (src/lib/refunds/config.ts); this module
 * only decides which of those tiers applies right now:
 *
 * - Cutoff EXTERNAL_SUBMISSION = the application was sent to the embassy /
 *   airline / vendor, i.e. BookingStatus PROCESSING or COMPLETED.
 * - Cutoff PACKAGE_GENERATED = a PACKAGE_PDF document exists on the booking
 *   (or the booking is COMPLETED).
 * - Within `fullRefundWindowHours` of payment: gateway charges only.
 * - After that: `postValidationDeduction` once every booking document is
 *   VERIFIED, otherwise `preValidationDeduction`.
 * - Visa Extension outcomes stay as locked: Rejected = no refund, Not
 *   Accepted = refund minus gateway charges only.
 */

export interface RefundRuleContext {
  serviceType: ServiceType;
  bookingStatus: BookingStatus;
  /** Every Document attached to this booking is VERIFIED, and at least one exists. */
  documentsValidated: boolean;
  /** A PACKAGE_PDF output document exists on the booking. */
  packageGenerated?: boolean;
  /** Visa Extension only — see Booking.extensionOutcome. */
  extensionOutcome: ExtensionOutcome | null;
  /** When the payment succeeded — for the full-refund window. */
  paymentSucceededAt: Date;
  now?: Date;
}

export interface RefundRuleResult {
  /** false = hard-blocked; no refund can be raised at all while this holds. */
  allowed: boolean;
  /** Mandatory deduction on top of staff-entered cancellationCharge/gatewayCharge — always server-computed. */
  fixedDeduction: number;
  /** Human-readable explanation — surfaced in the refund calculator UI. */
  label: string;
}

function blocked(label: string): RefundRuleResult {
  return { allowed: false, fixedDeduction: 0, label };
}

/** "Documents validated" = every document currently attached to this booking has reached VERIFIED, and at least one exists. */
export function documentsValidated(documentStatuses: { status: string }[]): boolean {
  return documentStatuses.length > 0 && documentStatuses.every((document) => document.status === "VERIFIED");
}

/** True when the booking carries a generated service package (PACKAGE_PDF output document). */
export function packageGenerated(documents: { type: string }[]): boolean {
  return documents.some((document) => document.type === "PACKAGE_PDF");
}

const CUTOFF_LABEL: Record<Exclude<RefundConfigValues["noRefundAfter"], "NEVER">, string> = {
  EXTERNAL_SUBMISSION: "No refund — the application has already been sent to the embassy / airline / vendor.",
  PACKAGE_GENERATED: "No refund — the service package has already been generated.",
};

export function evaluateRefundRule(context: RefundRuleContext, config: RefundConfigValues): RefundRuleResult {
  const now = context.now ?? new Date();
  const externallySubmitted = context.bookingStatus === "PROCESSING" || context.bookingStatus === "COMPLETED";

  if (config.noRefundAfter === "EXTERNAL_SUBMISSION" && externallySubmitted) {
    return blocked(CUTOFF_LABEL.EXTERNAL_SUBMISSION);
  }
  if (config.noRefundAfter === "PACKAGE_GENERATED" && (context.packageGenerated || context.bookingStatus === "COMPLETED")) {
    return blocked(CUTOFF_LABEL.PACKAGE_GENERATED);
  }

  if (context.serviceType === "VISA_EXTENSION") {
    if (context.extensionOutcome === "REJECTED") return blocked("No refund — the extension was formally rejected.");
    if (context.extensionOutcome === "NOT_ACCEPTED") {
      return { allowed: true, fixedDeduction: 0, label: "Refund minus gateway charges — the sponsor/authority did not accept the extension." };
    }
  }

  if (config.fullRefundWindowHours !== null) {
    const withinWindow = now.getTime() - context.paymentSucceededAt.getTime() <= config.fullRefundWindowHours * 60 * 60 * 1000;
    if (withinWindow) {
      return { allowed: true, fixedDeduction: 0, label: `Full refund minus gateway charges — within ${config.fullRefundWindowHours} hours of payment.` };
    }
  }

  const deduction = context.documentsValidated ? config.postValidationDeduction : config.preValidationDeduction;
  if (deduction > 0) {
    return {
      allowed: true,
      fixedDeduction: deduction,
      label: `₹${deduction} deduction + gateway charges — ${context.documentsValidated ? "documents already validated" : "before document validation"}.`,
    };
  }
  return { allowed: true, fixedDeduction: 0, label: "Gateway charges and any entered cancellation charge only — no service-specific deduction applies." };
}
