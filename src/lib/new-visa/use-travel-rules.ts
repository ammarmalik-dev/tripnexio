"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import { DEFAULT_MIN_TRAVEL_DAYS, type NewVisaTravelRules } from "./products";

const DEFAULT_RULES: NewVisaTravelRules = {
  minTravelDaysNormal: DEFAULT_MIN_TRAVEL_DAYS.normal,
  minTravelDaysExpress: DEFAULT_MIN_TRAVEL_DAYS.urgent,
};

/**
 * The New Visa timeline for a destination (GET /api/new-visa-rules), with the
 * 7 / 3 defaults until it loads or if it can't be read — the server re-checks
 * on submit. Client testing 2026-10-09 (B31): per-country values apply.
 */
export function useNewVisaTravelRules(countryCode: string | null | undefined): NewVisaTravelRules {
  const [rules, setRules] = useState<NewVisaTravelRules>(DEFAULT_RULES);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = countryCode ? `?country=${encodeURIComponent(countryCode)}` : "";
        const result = await getJson<NewVisaTravelRules>(`/api/new-visa-rules${query}`);
        if (!cancelled) setRules(result);
      } catch {
        // Keep the defaults.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [countryCode]);
  return rules;
}
