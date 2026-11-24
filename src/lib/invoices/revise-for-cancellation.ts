import type { PaxType } from "../../generated/prisma/enums";
import { PAX_LINE_LABELS } from "./invoice-lines";

const round2 = (value: number) => Math.round(value * 100) / 100;

export interface RevisableLine {
  description: string;
  sac: string | null;
  quantity: number;
  governmentFee: number;
  serviceFee: number;
}

/**
 * Client doc 16 Nov (H11) — after a partial cancellation the invoice shows only the remaining passengers: a per
 * passenger-type line ("Adult" ×2) loses the cancelled passengers of that type; lines that are not per passenger type
 * are reduced in proportion (remaining ÷ all passengers). The Protection Plan line is kept. GST follows the taxable
 * service fee. Returns null when nobody is cancelled (or everybody is — the invoice then reads Cancelled / Refunded).
 */
export function reviseForCancelledPassengers(
  lines: RevisableLine[],
  gstAmount: number,
  passengers: { paxType: PaxType; cancelled: boolean }[]
): { lines: RevisableLine[]; gstAmount: number; remaining: number; total: number } | null {
  const total = passengers.length;
  const cancelled = passengers.filter((passenger) => passenger.cancelled);
  const remaining = total - cancelled.length;
  if (cancelled.length === 0 || remaining <= 0) return null;

  const cancelledByLabel = new Map<string, number>();
  for (const passenger of cancelled) {
    const label = PAX_LINE_LABELS[passenger.paxType];
    cancelledByLabel.set(label, (cancelledByLabel.get(label) ?? 0) + 1);
  }
  const isPaxLine = (line: RevisableLine) => Object.values(PAX_LINE_LABELS).includes(line.description);
  const perType = lines.some(isPaxLine);
  const ratio = remaining / total;

  const revised = lines
    .map((line) => {
      if (line.description === "Protection Plan") return line;
      if (perType && isPaxLine(line)) {
        const drop = Math.min(line.quantity, cancelledByLabel.get(line.description) ?? 0);
        if (drop === 0) return line;
        const keep = line.quantity - drop;
        const factor = line.quantity > 0 ? keep / line.quantity : 0;
        return { ...line, quantity: keep, governmentFee: round2(line.governmentFee * factor), serviceFee: round2(line.serviceFee * factor) };
      }
      if (perType) return line;
      return { ...line, governmentFee: round2(line.governmentFee * ratio), serviceFee: round2(line.serviceFee * ratio) };
    })
    .filter((line) => line.quantity > 0 || line.governmentFee + line.serviceFee > 0);

  const before = lines.reduce((sum, line) => sum + line.serviceFee, 0);
  const after = revised.reduce((sum, line) => sum + line.serviceFee, 0);
  return { lines: revised, gstAmount: before > 0 ? round2((gstAmount * after) / before) : 0, remaining, total };
}
