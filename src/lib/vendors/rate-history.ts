import type { VendorService } from "../../generated/prisma/client";
import type { HistorySnapshot } from "../pricing/rule-history";

/** JSON-safe snapshot of one VendorService's rate fields (Decimals as numbers, dates as YYYY-MM-DD). */
export function vendorRateSnapshot(row: Pick<VendorService, "cost" | "rate" | "validFrom" | "validUntil">): HistorySnapshot {
  return {
    cost: row.cost === null ? null : Number(row.cost.toString()),
    rate: row.rate === null ? null : Number(row.rate.toString()),
    validFrom: row.validFrom ? row.validFrom.toISOString().slice(0, 10) : null,
    validUntil: row.validUntil ? row.validUntil.toISOString().slice(0, 10) : null,
  };
}
