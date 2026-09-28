"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";

export interface NationalityOption {
  id: string;
  name: string;
}

/** Admin-managed nationality list for the Visa Change passenger picker. */
export function useNationalities(): { options: NationalityOption[]; loading: boolean } {
  const [options, setOptions] = useState<NationalityOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<NationalityOption[]>("/api/nationalities");
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
