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
