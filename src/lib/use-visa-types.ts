"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";

export interface VisaTypeOption {
  id: string;
  name: string;
}

/**
 * Admin-managed New Visa "Visa Type" options for a destination country code
 * (types for that country plus the ones offered everywhere). Empty until a
 * country is picked; `loading` stays true while a fetch is in flight.
 */
export function useVisaTypes(countryCode: string): { options: VisaTypeOption[]; loading: boolean } {
  const [result, setResult] = useState<{ country: string; options: VisaTypeOption[] } | null>(null);

  useEffect(() => {
    if (!countryCode) return;
    let cancelled = false;
    async function load() {
      try {
        const options = await getJson<VisaTypeOption[]>(`/api/visa-types?country=${encodeURIComponent(countryCode)}`);
        if (!cancelled) setResult({ country: countryCode, options });
      } catch {
        if (!cancelled) setResult({ country: countryCode, options: [] });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  if (!countryCode) return { options: [], loading: false };
  const current = result?.country === countryCode ? result : null;
  return { options: current?.options ?? [], loading: current === null };
}
