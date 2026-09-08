"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";

export interface CountryOption {
  id: string;
  code: string;
  name: string;
}

/**
 * Shared by AirportsManager/BordersManager (and CountriesManager doesn't
 * need it — it manages the Country rows themselves) to populate a country
 * `<select>` from the real Admin-managed list, replacing the old hardcoded
 * GccCountry enum. Fetches once per mount; callers that create a country
 * inline should just wait for a page refresh to see it here — this isn't
 * meant to be a live-updating store.
 */
export function useCountries() {
  const [countries, setCountries] = useState<CountryOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<CountryOption[]>("/api/admin/countries");
        if (!cancelled) setCountries(result);
      } catch {
        // The select just stays empty — not worth a toast for a background list load.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return countries;
}
