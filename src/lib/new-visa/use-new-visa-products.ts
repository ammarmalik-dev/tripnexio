"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";

export interface NewVisaProductOption {
  id: string;
  countryCode: string;
  label: string;
  fromPrice: number | null;
}

/** P10 — the active New Visa products (country + stay + entry); `loading` until the list arrives. */
export function useNewVisaProducts(): { products: NewVisaProductOption[]; loading: boolean } {
  const [products, setProducts] = useState<NewVisaProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<NewVisaProductOption[]>("/api/new-visa-countries");
        if (!cancelled) setProducts(result);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  return { products, loading };
}
