"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";

export type NewVisaRates = Record<"normal" | "urgent", { adult: number | null; child: number | null }>;

/**
 * One Adult and one Child price for each of Normal / Express (GET
 * /api/new-visa-price?rates=1) for a destination, visa option and passport
 * nationality — the same Admin prices the payment uses. A rate with no Admin
 * price is null (shown as not offered). Null while loading or unavailable.
 */
export function useNewVisaRates(countryCode: string, configId: string, nationalityId: string): NewVisaRates | null {
  const [rates, setRates] = useState<{ key: string; value: NewVisaRates } | null>(null);
  const key = `${countryCode}|${configId}|${nationalityId}`;

  useEffect(() => {
    if (!countryCode) return;
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({ countryCode, rates: "1" });
        if (configId) params.set("configId", configId);
        if (nationalityId) params.set("nationalityId", nationalityId);
        const result = await getJson<NewVisaRates>(`/api/new-visa-price?${params.toString()}`);
        if (!cancelled) setRates({ key: `${countryCode}|${configId}|${nationalityId}`, value: result });
      } catch {
        // Prices simply aren't shown; the summary step still prices the request.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [countryCode, configId, nationalityId]);

  return rates?.key === key ? rates.value : null;
}
