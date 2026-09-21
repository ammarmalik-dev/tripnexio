"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";

export interface OccupationOption {
  id: string;
  name: string;
}

/** Admin-managed occupation list for the New Visa traveller dropdown. */
export function useOccupations(): { options: OccupationOption[]; loading: boolean } {
  const [options, setOptions] = useState<OccupationOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<OccupationOption[]>("/api/occupations");
        if (!cancelled) setOptions(result);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading };
}
