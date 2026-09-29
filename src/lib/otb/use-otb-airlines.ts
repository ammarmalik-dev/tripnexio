"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import type { OtbAirlineRules } from "./processing-rules";

export interface OtbAirlineOption extends OtbAirlineRules {
  code: string;
  name: string;
  normalPrice: number | null;
  urgentPrice: number | null;
  /** P18 — Admin OTB prices by destination country + passenger type (fallback: the airline prices above). */
  prices: { countryCode: string; paxType: "ADULT" | "CHILD" | "INFANT"; normalPrice: number; urgentPrice: number | null }[];
}

/** P18 — same rule as the server (src/lib/otb/pricing.ts): the matching OTB price, else the airline's own price. */
export function otbApplicantPrice(
  airline: OtbAirlineOption,
  countryCode: string,
  paxType: string | undefined,
  processingType: "normal" | "urgent" | undefined
): number | null {
  const row = airline.prices.find((p) => p.countryCode.toLowerCase() === countryCode.toLowerCase() && p.paxType === (paxType ?? "ADULT"));
  const rowPrice = row ? (processingType === "urgent" ? row.urgentPrice : row.normalPrice) : null;
  if (rowPrice !== null) return rowPrice;
  return processingType === "urgent" ? airline.urgentPrice : airline.normalPrice;
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
