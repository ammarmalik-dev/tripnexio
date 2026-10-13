"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import type { OtbAirlineRules } from "./processing-rules";

export interface OtbAirlineOption extends OtbAirlineRules {
  code: string;
  name: string;
  /** Admin OTB price per destination country — one rate for every passenger (client reply 2026-10-13). */
  prices: { countryCode: string; normalPrice: number; urgentPrice: number | null }[];
}

function countryRow(airline: OtbAirlineOption, countryCode: string) {
  return airline.prices.find((p) => p.countryCode.toLowerCase() === countryCode.toLowerCase()) ?? null;
}

/** Same rule as the server (src/lib/otb/pricing.ts): the airline's price for this country, per applicant; null = not configured. */
export function otbApplicantPrice(airline: OtbAirlineOption, countryCode: string, processingType: "normal" | "urgent" | undefined): number | null {
  const row = countryRow(airline, countryCode);
  if (!row) return null;
  return processingType === "urgent" ? row.urgentPrice : row.normalPrice;
}

/** The airline's timelines for this destination: Urgent only when the country price has an urgent amount. */
export function otbRulesForCountry(airline: OtbAirlineOption, countryCode: string): OtbAirlineRules {
  return { ...airline, urgentAvailable: countryRow(airline, countryCode)?.urgentPrice != null };
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
