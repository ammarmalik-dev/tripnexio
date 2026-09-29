import type { BookingStatus, ExtensionOutcome, ServiceType } from "../../generated/prisma/enums";
import type { RefundConfigValues } from "./config";

/**
 * Per-service refund rules on top of computeRefundAmount's generic arithmetic
 * (src/lib/refunds/pricing.ts). The amounts, time window and cutoff come from
 * the Admin-managed RefundConfig (src/lib/refunds/config.ts); this module
 * only decides which of those tiers applies right now:
 *
 * - Cutoff EXTERNAL_SUBMISSION = the application was sent to the embassy /
 *   airline / vendor — read from the booking's per-service status
 *   (ServiceStatus.blocksRefund, Admin-editable, P08); only a booking with
 *   no per-service status falls back to BookingStatus PROCESSING/COMPLETED.
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
  /** The booking's per-service status blocksRefund flag; null/undefined when it has no per-service status. */
  blocksRefund?: boolean | null;
  /** Every Document attached to this booking is VERIFIED, and at least one exists. */
  documentsValidated: boolean;
  /** A PACKAGE_PDF output document exists on the booking. */
  packageGenerated?: boolean;
  /** Visa Extension only — see Booking.extensionOutcome. */
  extensionOutcome: ExtensionOutcome | null;
  /** When the payment succeeded — for the full-refund window. */
  paymentSucceededAt: Date;
  /** P17 — Return Ticket only: the destination's Admin-set cancellation fee (null = none set). */
  cancellationFee?: number | null;
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
  const externallySubmitted =
    context.blocksRefund ?? (context.bookingStatus === "PROCESSING" || context.bookingStatus === "COMPLETED");

  // P17 — Return_Verified_Ticket.md §16-17 (locked): no refund once
  // forwarded to the airline/vendor or after issuance, whatever the Admin
  // cutoff setting says.
  if (context.serviceType === "RETURN_TICKET" && externallySubmitted) {
    return blocked("No refund — the request has already been forwarded to the airline / vendor.");
  }
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

  // P17 — the destination's cancellation fee, shown to the customer before
  // payment, is the service-specific deduction for a Return Ticket
  // cancelled before forwarding (gateway charges are entered on top).
  if (context.serviceType === "RETURN_TICKET" && context.cancellationFee != null && context.cancellationFee > 0) {
    return {
      allowed: true,
      fixedDeduction: context.cancellationFee,
      label: `₹${context.cancellationFee} destination cancellation fee + gateway charges (before forwarding).`,
    };
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
