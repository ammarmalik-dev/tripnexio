import { z } from "zod";
import type { ServiceType } from "../../generated/prisma/enums";
import type { InvoiceLine } from "../invoices/invoice-lines";

/**
 * Client doc 2026-10-15 (D1/D3, E4) — Visa Extension and Visa Change are costed per passenger:
 * Vendor (on the quote), and for each passenger the vendor cost, the fine and the selling amount.
 * Profit = Selling − Cost − Fine; GST is charged on the profit only (cost and fine are the
 * non-taxable Govt./Vendor fee and fine on the invoice); the gateway charge is on the full amount.
 * A passenger left out of the quote is not part of it (partial approval): the customer pays for
 * the quoted passengers only and the booking holds just them.
 */
export const PAX_COSTING_SERVICES: readonly ServiceType[] = ["VISA_EXTENSION", "VISA_CHANGE"];

export function usesPaxCosting(serviceType: ServiceType): boolean {
  return PAX_COSTING_SERVICES.includes(serviceType);
}

const amount = (label: string) => z.number({ error: `Enter the ${label}` }).nonnegative(`The ${label} can't be negative`).max(10_000_000);

export const paxCostingLineSchema = z.object({
  passengerId: z.string().min(1),
  cost: amount("cost"),
  fine: amount("fine"),
  selling: amount("selling amount"),
});

export const paxCostingSchema = z.array(paxCostingLineSchema).max(20);

export type PaxCostingLine = z.infer<typeof paxCostingLineSchema>;

/** Stored on the quotation (Quotation.paxCosting) — the passenger's name is snapshotted for the customer view and invoice. */
export interface StoredPaxCostingLine extends PaxCostingLine {
  fullName: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Profit of one line (never below 0 on the invoice; a loss shows as 0 service fee). */
export function paxLineProfit(line: Pick<PaxCostingLine, "cost" | "fine" | "selling">): number {
  return round2(line.selling - line.cost - line.fine);
}

/**
 * The quotation's money fields from its passenger lines. `passengers` are the lead's own
 * passengers (looked up by the caller); any other id is refused. Returns an error message or the
 * fields to store: vendorCost = Σ cost, fineOrCharges = Σ fine, feeAmount = Σ selling − Σ fine
 * (so the computed selling price is Σ selling), governmentFee = Σ cost, invoice lines per passenger.
 */
export function resolvePaxCosting(
  serviceLabel: string,
  lines: PaxCostingLine[],
  passengers: { id: string; fullName: string }[]
):
  | { ok: false; error: string }
  | {
      ok: true;
      fields: {
        vendorCost: number;
        feeAmount: number;
        fineOrCharges: number;
        otherCharges: number;
        governmentFee: number;
        paxCosting: StoredPaxCostingLine[];
        invoiceLines: InvoiceLine[];
      };
      totals: { cost: number; fine: number; selling: number; profit: number };
    } {
  if (lines.length === 0) return { ok: false, error: "Add the cost, fine and selling amount for at least one passenger." };
  const seen = new Set<string>();
  const stored: StoredPaxCostingLine[] = [];
  for (const line of lines) {
    const passenger = passengers.find((entry) => entry.id === line.passengerId);
    if (!passenger) return { ok: false, error: "A passenger on this quote isn't on the lead." };
    if (seen.has(line.passengerId)) return { ok: false, error: `${passenger.fullName} is on the quote twice.` };
    seen.add(line.passengerId);
    if (line.selling < line.fine) return { ok: false, error: `${passenger.fullName}: the selling amount can't be less than the fine.` };
    stored.push({ ...line, cost: round2(line.cost), fine: round2(line.fine), selling: round2(line.selling), fullName: passenger.fullName });
  }
  const cost = round2(stored.reduce((sum, line) => sum + line.cost, 0));
  const fine = round2(stored.reduce((sum, line) => sum + line.fine, 0));
  const selling = round2(stored.reduce((sum, line) => sum + line.selling, 0));
  if (selling <= 0) return { ok: false, error: "Enter the selling amount for the passengers on this quote." };
  // Per passenger: the vendor cost is the non-taxable fee (capped at what's left after the fine), the
  // rest less the fine is the taxable service charge. The fine is added as its own invoice line.
  const invoiceLines: InvoiceLine[] = stored.map((line) => {
    const governmentFee = round2(Math.min(line.cost, line.selling - line.fine));
    return { description: `${serviceLabel} — ${line.fullName}`, quantity: 1, governmentFee, serviceFee: round2(line.selling - line.fine - governmentFee) };
  });
  return {
    ok: true,
    fields: {
      vendorCost: cost,
      feeAmount: round2(selling - fine),
      fineOrCharges: fine,
      otherCharges: 0,
      governmentFee: round2(invoiceLines.reduce((sum, line) => sum + line.governmentFee, 0)),
      paxCosting: stored,
      invoiceLines,
    },
    totals: { cost, fine, selling, profit: round2(selling - cost - fine) },
  };
}

/** The passengers a quote covers (partial approval); empty = every passenger of the lead. */
export function quotedPassengerIds(paxCosting: unknown): string[] {
  if (!Array.isArray(paxCosting)) return [];
  return paxCosting
    .map((line) => (line && typeof line === "object" ? (line as { passengerId?: unknown }).passengerId : null))
    .filter((id): id is string => typeof id === "string");
}

/** Customer-safe view of the passenger lines: name, fine and amount — never the vendor cost. */
export function customerPaxLines(paxCosting: unknown): { fullName: string; fine: number; amount: number }[] {
  if (!Array.isArray(paxCosting)) return [];
  return paxCosting
    .filter((line): line is StoredPaxCostingLine => !!line && typeof line === "object" && typeof (line as StoredPaxCostingLine).fullName === "string")
    .map((line) => ({ fullName: line.fullName, fine: Number(line.fine) || 0, amount: Number(line.selling) || 0 }));
}

/** Margin = Selling − Vendor cost − Fine for services whose fine is a pass-through fee (client doc 2026-10-15). */
export function quotationMargin(serviceType: ServiceType, sellingPrice: number, vendorCost: number, fine: number | undefined): number {
  return round2(sellingPrice - vendorCost - (usesPaxCosting(serviceType) ? (fine ?? 0) : 0));
}
