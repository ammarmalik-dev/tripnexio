import { db } from "../db";

export interface PaxCounts {
  adult: number;
  child: number;
  infant: number;
}

function count(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

/**
 * A Special Fare lead's travellers by Adult / Child / Infant: its linked
 * passengers, else the counts on the lead (manual lead / bot), else its PAX
 * count as adults. Used to show the counts on the quote and to price a quote
 * from its per-passenger fares (client doc 2026-10-14).
 */
export async function specialFarePaxCounts(lead: { details: unknown; paxCount: number | null }): Promise<PaxCounts> {
  const details = (lead.details ?? {}) as Record<string, unknown>;
  // The counts the customer gave (bot / manual lead) — client doc 2026-10-20 (A4): never fewer travellers than these.
  const asked = { adult: count(details.adultCount ?? details.adults), child: count(details.childCount ?? details.children), infant: count(details.infantCount ?? details.infants) };
  const askedTotal = asked.adult + asked.child + asked.infant;
  const ids = Array.isArray(details.passengerIds) ? details.passengerIds.filter((id): id is string => typeof id === "string") : [];
  if (ids.length > 0) {
    const passengers = await db.passenger.findMany({ where: { id: { in: ids } }, select: { paxType: true } });
    if (passengers.length > 0 && passengers.length >= askedTotal) {
      return {
        adult: passengers.filter((p) => (p.paxType ?? "ADULT") === "ADULT").length,
        child: passengers.filter((p) => p.paxType === "CHILD").length,
        infant: passengers.filter((p) => p.paxType === "INFANT").length,
      };
    }
  }
  if (askedTotal > 0) return asked;
  return { adult: Math.max(1, lead.paxCount ?? 1), child: 0, infant: 0 };
}

/**
 * A Special Fare quote's totals from its per-passenger rates: the selling price
 * and vendor cost (when rates were entered; else the sent totals stand), and the
 * non-taxable airline part of the invoice = the vendor cost, capped at the price
 * (client doc 2026-10-14: no separate "airline fare inside price" entry).
 */
export function specialFareTotals(
  input: {
    adultFare?: number;
    childFare?: number;
    infantFare?: number;
    adultVendorCost?: number;
    childVendorCost?: number;
    infantVendorCost?: number;
    sellingPrice?: number;
    vendorCost?: number;
  },
  counts: PaxCounts
): { sellingPrice?: number; vendorCost?: number; governmentFee?: number } {
  const selling = perPaxTotal({ adult: input.adultFare, child: input.childFare, infant: input.infantFare }, counts) ?? input.sellingPrice;
  const cost = perPaxTotal({ adult: input.adultVendorCost, child: input.childVendorCost, infant: input.infantVendorCost }, counts) ?? input.vendorCost;
  return {
    ...(selling !== undefined ? { sellingPrice: selling } : {}),
    ...(cost !== undefined ? { vendorCost: cost } : {}),
    ...(selling !== undefined && cost !== undefined ? { governmentFee: Math.min(cost, selling) } : {}),
  };
}

/** Σ rate × count for the passenger types that have a rate; null when no rate was entered at all. */
export function perPaxTotal(rates: { adult?: number | null; child?: number | null; infant?: number | null }, counts: PaxCounts): number | null {
  const entered = [rates.adult, rates.child, rates.infant].some((rate) => rate != null);
  if (!entered) return null;
  const total = (rates.adult ?? 0) * counts.adult + (rates.child ?? 0) * counts.child + (rates.infant ?? 0) * counts.infant;
  return Math.round(total * 100) / 100;
}
