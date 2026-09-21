"use client";

import { useEffect, useState } from "react";
import { getJson, ApiError } from "@/lib/api/client";
import type { ReturnTicketVisaType } from "@/lib/leads/compute-return-date";

export interface ReturnTicketDestinationOption {
  countryId: string;
  countryName: string;
  ratePerApplicant: number;
  validityOptions: ReturnTicketVisaType[];
}

type LoadState = "loading" | "success" | "error";

export function useReturnTicketDestinations() {
  const [state, setState] = useState<LoadState>("loading");
  const [destinations, setDestinations] = useState<ReturnTicketDestinationOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getJson<ReturnTicketDestinationOption[]>("/api/return-ticket/destinations");
        if (cancelled) return;
        setDestinations(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load destinations. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, destinations, errorMessage };
}

export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
