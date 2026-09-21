"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import type { OtbAirlineRules } from "./processing-rules";

export interface OtbAirlineOption extends OtbAirlineRules {
  code: string;
  name: string;
  normalPrice: number | null;
  urgentPrice: number | null;
}

/** Admin-managed OTB airlines with their prices and processing timelines. */
export function useOtbAirlines(): { state: "loading" | "success" | "error"; airlines: OtbAirlineOption[] } {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [airlines, setAirlines] = useState<OtbAirlineOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<OtbAirlineOption[]>("/api/otb/airlines");
        if (cancelled) return;
        setAirlines(result);
        setState("success");
      } catch {
        if (cancelled) return;
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, airlines };
}

export function formatOtbRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
