"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import { DEFAULT_WORKING_CALENDAR, type WorkingCalendar } from "./working-calendar";

/** The server's working calendar for a country; the Monday-Friday default until it loads (the server re-checks on submit anyway). */
export function useWorkingCalendar(country: "INDIA" | "UAE"): WorkingCalendar {
  const [calendar, setCalendar] = useState<WorkingCalendar>(DEFAULT_WORKING_CALENDAR);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<WorkingCalendar>(`/api/working-calendar?country=${country}`);
        if (!cancelled) setCalendar(result);
      } catch {
        // Keep the default — the server enforces the real calendar on submit.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [country]);
  return calendar;
}

/**
 * Client doc 2026-10-15 — the working calendar of a destination by its Country master code (its
 * own weekend and holidays), for the New Visa approval date and travel-date rules. The
 * Monday-Friday default until it loads; the server re-checks on submit.
 */
export function useCountryWorkingCalendar(countryCode: string | null | undefined): WorkingCalendar {
  const [calendar, setCalendar] = useState<WorkingCalendar>(DEFAULT_WORKING_CALENDAR);
  useEffect(() => {
    if (!countryCode) return;
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<WorkingCalendar>(`/api/working-calendar?countryCode=${encodeURIComponent(countryCode!)}`);
        if (!cancelled) setCalendar(result);
      } catch {
        // Keep the default — the server enforces the real calendar on submit.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [countryCode]);
  return calendar;
}
