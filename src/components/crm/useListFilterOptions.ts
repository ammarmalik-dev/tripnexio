"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * POC (staff) and Country options for the CRM list filters (client
 * corrections 2026-10-05: POC, Country and Travel Date filters on Leads,
 * Quotations and Bookings). A failed load just leaves the dropdown empty.
 */
export function useListFilterOptions(): { staff: FilterOption[]; countries: FilterOption[] } {
  const [staff, setStaff] = useState<FilterOption[]>([]);
  const [countries, setCountries] = useState<FilterOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [staffRows, countryRows] = await Promise.all([
        getJson<{ id: string; name: string }[]>("/api/staff").catch(() => []),
        getJson<{ id: string; name: string }[]>("/api/countries").catch(() => []),
      ]);
      if (cancelled) return;
      setStaff(staffRows.map((row) => ({ value: row.id, label: row.name })));
      setCountries(countryRows.map((row) => ({ value: row.id, label: row.name })));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { staff, countries };
}
