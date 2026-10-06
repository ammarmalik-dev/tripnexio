"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { cn } from "@/lib/cn";

interface DocumentTypeOption {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Client corrections 2026-10-05 — add a document to a list from the Document
 * Master instead of retyping its name (New Visa country pages). Names already
 * in the list are not offered again.
 */
export function DocumentMasterPicker({ current, onPick, disabled }: { current: string[]; onPick: (name: string) => void; disabled?: boolean }) {
  const [types, setTypes] = useState<DocumentTypeOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await getJson<DocumentTypeOption[]>("/api/admin/document-types");
        if (!cancelled) setTypes(rows.filter((row) => row.active));
      } catch {
        // Picker stays empty; typing still works.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const taken = new Set(current.map((name) => name.trim().toLowerCase()));
  const options = types.filter((type) => !taken.has(type.name.toLowerCase()));

  return (
    <select
      aria-label="Add a document from the Document Master"
      value=""
      disabled={disabled || options.length === 0}
      onChange={(event) => {
        if (event.target.value) onPick(event.target.value);
      }}
      className={cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm")}
    >
      <option value="">{options.length === 0 ? "All Document Master items added" : "+ Add from Document Master…"}</option>
      {options.map((type) => (
        <option key={type.id} value={type.name}>
          {type.name}
        </option>
      ))}
    </select>
  );
}
