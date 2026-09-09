import type { BookingStatus, ExtensionOutcome, ServiceType } from "../../generated/prisma/enums";

/**
 * Step 15 (client-locked-spec DEVELOPMENT_ROADMAP.md, audit §7.4): a
 * per-service refund rule layer on top of computeRefundAmount's generic
 * arithmetic (src/lib/refunds/pricing.ts). Re-read against
 * AUDIT_REPORT.md §7.4 and the underlying service MDs (New_Visa.md §25,
 * Visa_Extension.md §17-18, Return_Verified_Ticket.md §16-17, OTB.md §16,
 * Flight_Special_Fare.md §19).
 *
 * Every hard-block/tier check below is keyed off signals that already exist
 * in the schema — no new generic "status engine" was built (CRM.md §14
 * describes a much larger, fully Admin-configurable per-service status
 * list; that's a distinct, unbuilt feature, not what this reuses):
 *
 * - "Sent to the embassy/airline/vendor" (New Visa's embassy submission,
 *   OTB's airline processing, Return Ticket's forwarding-to-vendor) all map
 *   onto the existing `BookingStatus.PROCESSING` — the same interpretation
 *   already established for the CRM dashboard's "External Processing" KPI
 *   (Step 11), not a new invention.
 * - "Documents validated" (New Visa, OTB) is computed from whether every
 *   Document currently attached to the booking has reached VERIFIED status
 *   (and at least one exists) — see documentsValidated() below. This
 *   REPLACES the old OTB-only `otbValidated` manual staff checkbox, which
 *   was explicitly documented as "a manual staff attestation standing in
 *   for a real validation-status field" — this is that real signal.
 * - "Not Accepted" vs "Rejected" (Visa Extension) needed an actual schema
 *   addition, per the roadmap prompt's own instruction — see
 *   Booking.extensionOutcome and its own schema doc comment.
 */

export interface RefundRuleContext {
  serviceType: ServiceType;
  bookingStatus: BookingStatus;
  /** Every Document attached to this booking is VERIFIED, and at least one exists. */
  documentsValidated: boolean;
  /** Visa Extension only — see Booking.extensionOutcome. */
  extensionOutcome: ExtensionOutcome | null;
  /** When the payment succeeded — for New Visa's 4-hour window. */
  paymentSucceededAt: Date;
  now?: Date;
}

export interface RefundRuleResult {
  /** false = hard-blocked; no refund can be raised at all while this holds. */
  allowed: boolean;
  /** Mandatory deduction on top of staff-entered cancellationCharge/gatewayCharge (e.g. OTB/New Visa's ₹250) — always server-computed. */
  fixedDeduction: number;
  /** Human-readable explanation — surfaced in the refund calculator UI so staff aren't confused when a refund is blocked or reduced. */
  label: string;
}

const NEW_VISA_POST_VALIDATION_CHARGE = 250;
const OTB_POST_VALIDATION_CHARGE = 250;
const NEW_VISA_FULL_REFUND_WINDOW_MS = 4 * 60 * 60 * 1000;

/** PROCESSING (or anything past it, i.e. COMPLETED) — "sent to an external party," see this module's own doc comment. */
function hasReachedExternalProcessing(status: BookingStatus): boolean {
  return status === "PROCESSING" || status === "COMPLETED";
}

function blocked(label: string): RefundRuleResult {
  return { allowed: false, fixedDeduction: 0, label };
}

/** "Documents validated" = every document currently attached to this booking has reached VERIFIED, and at least one exists. */
export function documentsValidated(documentStatuses: { status: string }[]): boolean {
  return documentStatuses.length > 0 && documentStatuses.every((document) => document.status === "VERIFIED");
}

export function evaluateRefundRule(context: RefundRuleContext): RefundRuleResult {
  const now = context.now ?? new Date();

  switch (context.serviceType) {
    case "NEW_VISA": {
      if (hasReachedExternalProcessing(context.bookingStatus)) {
        return blocked("No refund — the application has already been submitted to the Embassy (New_Visa.md §25).");
      }
      const withinWindow = now.getTime() - context.paymentSucceededAt.getTime() <= NEW_VISA_FULL_REFUND_WINDOW_MS;
      if (withinWindow) {
        return { allowed: true, fixedDeduction: 0, label: "Full refund minus gateway charges — within 4 hours of payment (New_Visa.md §25)." };
      }
      // Outside the 4-hour window but not yet at Embassy submission — New_Visa.md
      // §25 only names three tiers (4h window / post-validation / post-submission);
      // it doesn't separately address "past 4h, documents not yet validated." Read
      // as: the 4-hour window is an early-cancellation bonus, and the standard
      // ₹250 tier is what applies for the rest of the pre-submission period —
      // not a fourth, undefined case.
      return {
        allowed: true,
        fixedDeduction: NEW_VISA_POST_VALIDATION_CHARGE,
        label: `₹${NEW_VISA_POST_VALIDATION_CHARGE} deduction + gateway charges — outside the 4-hour window (New_Visa.md §25).`,
      };
    }

    case "VISA_EXTENSION": {
      if (context.extensionOutcome === "REJECTED") {
        return blocked("No refund — formally rejected (Visa_Extension.md §17-18).");
      }
      if (context.extensionOutcome === "NOT_ACCEPTED") {
        return {
          allowed: true,
          fixedDeduction: 0,
          label: "Refund minus gateway charges — sponsor/authority did not accept the extension (Visa_Extension.md §17-18).",
        };
      }
      // No Not-Accepted/Rejected outcome recorded yet — Visa_Extension.md's
      // refund rule is specifically about those two terminal outcomes; it
      // doesn't address a refund requested before either is reached, so
      // nothing is blocked or deducted here beyond the generic calculation.
      return {
        allowed: true,
        fixedDeduction: 0,
        label: "No Not Accepted/Rejected outcome recorded yet — record the outcome first if applicable, or the generic refund calculation applies as-is.",
      };
    }

    case "RETURN_TICKET": {
      if (hasReachedExternalProcessing(context.bookingStatus)) {
        return blocked("No refund — documents have already been forwarded to the airline/vendor (Return_Verified_Ticket.md §16-17). No partial tier applies once forwarded.");
      }
      return {
        allowed: true,
        fixedDeduction: 0,
        label: "Refund allowed per the configured cancellation policy — documents not yet forwarded to the vendor (Return_Verified_Ticket.md §17).",
      };
    }

    case "OTB": {
      if (hasReachedExternalProcessing(context.bookingStatus)) {
        return blocked("No refund — already sent for airline processing (OTB.md §16, locked rule #22).");
      }
      if (context.documentsValidated) {
        return {
          allowed: true,
          fixedDeduction: OTB_POST_VALIDATION_CHARGE,
          label: `₹${OTB_POST_VALIDATION_CHARGE} deduction + gateway charges — documents already validated (OTB.md §16).`,
        };
      }
      return { allowed: true, fixedDeduction: 0, label: "Gateway charges only — before document validation (OTB.md §16)." };
    }

    case "FLIGHT_SPECIAL_FARE": {
      // Flight_Special_Fare.md §19: "Refund = Paid Amount - Vendor/Airline
      // Cancellation Charge - Gateway Charge" — already exactly what the
      // generic staff-entered-figures calculation does; confirmed
      // compatible, no additional tier or block layered on (AUDIT_REPORT.md
      // §7.4: "BUILT-ish, closest match of the six").
      return {
        allowed: true,
        fixedDeduction: 0,
        label: "Paid amount minus vendor/airline cancellation charge and gateway charge — no additional service-specific rule (Flight_Special_Fare.md §19).",
      };
    }

    case "VISA_CHANGE":
    default:
      // Visa_Change.md doesn't specify a refund rule of its own
      // (AUDIT_REPORT.md §7.4: "NOT SPECIFIED / no conflict") — generic
      // calculation applies, unchanged from before this step.
      return { allowed: true, fixedDeduction: 0, label: "No service-specific refund rule defined for this service — the generic refund calculation applies." };
  }
}
