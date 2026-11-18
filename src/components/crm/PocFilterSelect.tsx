"use client";

import { useEffect, useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface StaffOption {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Client doc 16 Nov (K3) — the shared "Filter by POC" select (All POCs / Unassigned / each staff member) for list
 * pages. Loads the staff list itself; if that fails the select just offers All / Unassigned.
 */
export function PocFilterSelect({
  id,
  value,
  onChange,
  allLabel = "All POCs",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
}) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      try {
        const result = await getJson<{ staff: StaffOption[] }>("/api/admin/bookings/filters");
        if (!cancelled) setStaff(result.staff);
      } catch {
        // The POC filter just keeps All / Unassigned.
      }
    }
    void loadStaff();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span>
      <label htmlFor={id} className="sr-only">
        Filter by POC
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[120px] max-w-[11rem] text-sm")}
      >
        <option value="">{allLabel}</option>
        <option value="unassigned">Unassigned</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.active ? member.name : `${member.name} (inactive)`}
          </option>
        ))}
      </select>
    </span>
  );
}
