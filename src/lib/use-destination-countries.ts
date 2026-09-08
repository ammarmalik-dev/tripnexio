"use client";

import { useEffect, useState } from "react";
import type { SelectOption } from "@/lib/sample-data";

/**
 * Destination-country options for the New Visa request flow, fetched from
 * the public `/api/countries` endpoint (active-only, ordered) instead of
 * the old hardcoded `DESTINATION_COUNTRY_OPTIONS` array — Step 6.1,
 * client-locked-spec roadmap: Admin can add/rename/reorder/disable a
 * country with zero deploys, and it shows up here immediately. Uses each
 * country's `code` (not its id) as the option value, since this is
 * descriptive lead data, not a foreign key.
 */
export function useDestinationCountryOptions(): SelectOption[] {
  const [options, setOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/countries");
        if (!res.ok) return;
        const json = (await res.json()) as { data: { code: string; name: string }[] };
        if (!cancelled) {
          setOptions(json.data.map((country) => ({ value: country.code, label: country.name })));
        }
      } catch {
        // The select just stays empty until it loads — not worth a toast for a background list load.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}
