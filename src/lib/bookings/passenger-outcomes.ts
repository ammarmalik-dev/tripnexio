import type { PassengerOutcome, PaxType } from "../../generated/prisma/enums";
import { PAX_LINE_LABELS } from "../invoices/invoice-lines";

/**
 * Client doc 2026-10-15 (I4) — each passenger of a booking can be approved, rejected or cancelled on
 * their own. This works out each passenger's selling price, cancellation amount and the refund it
 * implies (from the selected quotation), and the booking's overall label (Partially Approved / Partially
 * Cancelled). Pure, so it's unit-tested; the API supplies the rows.
 */

export const PASSENGER_OUTCOME_LABELS: Record<PassengerOutcome, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export interface OutcomePassenger {
  passengerId: string;
  paxType: PaxType;
  outcome: PassengerOutcome | null;
}

export interface OutcomeQuotation {
  sellingPrice: number;
  couponDiscount?: number | null;
  cancellationCharge?: number | null;
  /** Visa Extension / Change: [{ passengerId, selling, … }]. */
  paxCosting?: unknown;
  /** Per pax type: [{ description: "Adult", quantity, governmentFee, serviceFee }]. */
  invoiceLines?: unknown;
}

export interface PassengerAmounts {
  passengerId: string;
  selling: number;
  cancellation: number;
  /** What a cancellation / rejection would give back (selling − cancellation, never below 0). */
  refund: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object") : [];
}

export function passengerAmounts(passengers: OutcomePassenger[], quotation: OutcomeQuotation | null): PassengerAmounts[] {
  const count = passengers.length || 1;
  const total = Math.max(0, (quotation?.sellingPrice ?? 0) - (quotation?.couponDiscount ?? 0));
  const costing = rows(quotation?.paxCosting);
  const lines = rows(quotation?.invoiceLines);
  const cancellationEach = round2((quotation?.cancellationCharge ?? 0) / count);
  return passengers.map((passenger) => {
    const perPassenger = costing.find((row) => row.passengerId === passenger.passengerId);
    const paxLine = lines.find((line) => line.description === PAX_LINE_LABELS[passenger.paxType]);
    const selling = perPassenger
      ? Number(perPassenger.selling) || 0
      : paxLine
        ? (Number(paxLine.governmentFee) || 0) + (Number(paxLine.serviceFee) || 0)
        : total / count;
    const sellingRounded = round2(selling);
    const cancellation = Math.min(cancellationEach, sellingRounded);
    return { passengerId: passenger.passengerId, selling: sellingRounded, cancellation, refund: round2(Math.max(0, sellingRounded - cancellation)) };
  });
}

/** The booking's overall passenger outcome, or null while nobody has one (or everyone is simply approved). */
export function bookingOutcomeLabel(passengers: Pick<OutcomePassenger, "outcome">[]): string | null {
  const decided = passengers.filter((passenger) => passenger.outcome);
  if (decided.length === 0 || passengers.length < 1) return null;
  const approved = decided.filter((passenger) => passenger.outcome === "APPROVED").length;
  const rejected = decided.filter((passenger) => passenger.outcome === "REJECTED").length;
  const cancelled = decided.filter((passenger) => passenger.outcome === "CANCELLED").length;
  if (approved === passengers.length) return null;
  if (rejected === passengers.length) return "Rejected";
  if (cancelled === passengers.length) return "Cancelled";
  if (approved > 0 && rejected + cancelled > 0) return "Partially Approved";
  if (rejected + cancelled > 0) return rejected > 0 && cancelled === 0 ? "Partially Rejected" : "Partially Cancelled";
  return approved > 0 ? "Partially Approved" : null;
}
