import type { PaxType } from "../../generated/prisma/enums";

/**
 * Client corrections 2026-10-05 — an invoice line splits the government /
 * airline (third-party) fee from TripNexio's service fee, one line per
 * passenger type ("if child, keep separate"). Amounts are per unit.
 * Snapshotted on the Quotation (Quotation.invoiceLines) when the price is
 * set, so a later price change never alters an issued invoice.
 */
export interface InvoiceLine {
  description: string;
  quantity: number;
  governmentFee: number;
  serviceFee: number;
}

export const PAX_LINE_LABELS: Record<PaxType, string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Groups one priced item per passenger into invoice lines: passengers with
 * the same label and the same price / fee share a line (quantity = count).
 * `price` is the passenger's full price; `governmentFee` is the part of it
 * that is the third-party fee (capped at the price).
 */
export function groupInvoiceLines(items: { label: string; price: number; governmentFee: number }[]): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  for (const item of items) {
    const governmentFee = round2(Math.min(Math.max(item.governmentFee, 0), item.price));
    const serviceFee = round2(item.price - governmentFee);
    const existing = lines.find((line) => line.description === item.label && line.governmentFee === governmentFee && line.serviceFee === serviceFee);
    if (existing) existing.quantity += 1;
    else lines.push({ description: item.label, quantity: 1, governmentFee, serviceFee });
  }
  return lines;
}

export function invoiceLinesGovernmentFee(lines: InvoiceLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.quantity * line.governmentFee, 0));
}

/** Reads a stored Quotation.invoiceLines value; anything malformed → null (the invoice then shows one line). */
export function parseInvoiceLines(value: unknown): InvoiceLine[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const lines: InvoiceLine[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const line = raw as Record<string, unknown>;
    const quantity = Number(line.quantity);
    const governmentFee = Number(line.governmentFee);
    const serviceFee = Number(line.serviceFee);
    if (typeof line.description !== "string" || !(quantity > 0) || !Number.isFinite(governmentFee) || !Number.isFinite(serviceFee)) return null;
    lines.push({ description: line.description, quantity, governmentFee, serviceFee });
  }
  return lines;
}
