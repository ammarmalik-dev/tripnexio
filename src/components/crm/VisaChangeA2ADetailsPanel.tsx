"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { DateField } from "@/components/forms/DateField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { parseOperationalBlock } from "@/lib/visa-change/operational";

interface AirportOption {
  id: string;
  name: string;
  code: string;
}
interface Option {
  id: string;
  name: string;
  code?: string;
}

interface VisaChangeA2ADetailsPanelProps {
  leadId: string;
  /** Lead.details.a2aOperationalDetails as stored. */
  existing?: Record<string, unknown>;
  onSaved: (details: Record<string, unknown>) => void;
}

const TEXT_FIELDS = ["entryAirportId", "exitAirportId", "airlineCode", "flightNumber", "flightDate", "flightTime", "reportingTime", "vendorId", "cost", "sellingPrice", "instructions"] as const;
type FieldName = (typeof TEXT_FIELDS)[number];
const REQUIRED: FieldName[] = ["entryAirportId", "exitAirportId", "airlineCode", "flightNumber", "flightDate", "flightTime", "reportingTime", "vendorId", "cost", "sellingPrice"];

/**
 * Visa_Change.md §5/§6/§13 (P14) — the Airport-to-Airport operational
 * details staff enter on the lead (mirrors the Border panel). Airports come
 * from the common Airport master, filtered to those enabled for A2A entry /
 * exit; airline from the Airline master. Required before quoting; vendor,
 * cost and selling price stay internal (never shown to the customer).
 */
export function VisaChangeA2ADetailsPanel({ leadId, existing, onSaved }: VisaChangeA2ADetailsPanelProps) {
  const [entryAirports, setEntryAirports] = useState<AirportOption[]>([]);
  const [exitAirports, setExitAirports] = useState<AirportOption[]>([]);
  const [airlines, setAirlines] = useState<Option[]>([]);
  const [vendors, setVendors] = useState<Option[]>([]);
  const [form, setForm] = useState<Record<FieldName, string>>(
    () =>
      Object.fromEntries(
        TEXT_FIELDS.map((field) => {
          const value = existing?.[field];
          return [field, typeof value === "string" ? value : typeof value === "number" ? String(value) : ""];
        })
      ) as Record<FieldName, string>
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const complete = parseOperationalBlock(existing);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [airports, airlineList, vendorList] = await Promise.all([
          getJson<{ entry: AirportOption[]; exit: AirportOption[] }>("/api/visa-change/a2a-airports"),
          getJson<Option[]>("/api/airlines"),
          getJson<Option[]>("/api/vendors?service=VISA_CHANGE"),
        ]);
        if (cancelled) return;
        setEntryAirports(airports.entry);
        setExitAirports(airports.exit);
        setAirlines(airlineList);
        setVendors(vendorList);
      } catch {
        // The selects just stay empty — not worth a toast for a background list load.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (field: FieldName, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const result = await patchJson<{ a2aOperationalDetails: Record<string, unknown> }>(`/api/leads/${leadId}/visa-change-a2a-details`, {
        ...form,
        cost: Number(form.cost),
        sellingPrice: Number(form.sellingPrice),
      });
      toast.success("Airport-to-Airport details confirmed.");
      onSaved(result.a2aOperationalDetails);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save these details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const allFilled = REQUIRED.every((field) => form[field].trim());
  const select = (field: FieldName, label: string, options: { value: string; label: string }[], placeholder: string) => (
    <FormField label={label} htmlFor={`a2a-${field}`} error={errors[field]?.[0]} required>
      <select
        id={`a2a-${field}`}
        value={form[field]}
        disabled={saving}
        onChange={(event) => set(field, event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(!!errors[field]))}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-heading">Airport-to-Airport Operational Details</h2>
      <p className="mb-4 text-xs text-ink-tertiary">
        Required before this lead can be quoted, and printed on the customer&apos;s package PDF. Vendor, cost and selling price stay internal.
      </p>

      {complete ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Confirmed: {complete.kind === "A2A" ? `${complete.entryAirport} → ${complete.exitAirport}, ${complete.airline} ${complete.flightNumber}` : ""}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {select("entryAirportId", "Entry Airport", entryAirports.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })), "Select the entry airport")}
        {select("exitAirportId", "Exit Airport", exitAirports.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })), "Select the exit airport")}
        {select("airlineCode", "Airline", airlines.map((a) => ({ value: a.code ?? a.id, label: `${a.name}${a.code ? ` (${a.code})` : ""}` })), "Select the airline")}
        <TextField label="Flight Number" name="flightNumber" value={form.flightNumber} onChange={(e) => set("flightNumber", e.target.value)} error={errors.flightNumber?.[0]} disabled={saving} required />
        <DateField label="Flight Date" name="flightDate" value={form.flightDate} onChange={(e) => set("flightDate", e.target.value)} error={errors.flightDate?.[0]} disabled={saving} />
        <TextField label="Flight Time" name="flightTime" type="time" value={form.flightTime} onChange={(e) => set("flightTime", e.target.value)} error={errors.flightTime?.[0]} disabled={saving} required />
        <TextField label="Reporting Time" name="reportingTime" placeholder="e.g. 3 hours before departure" value={form.reportingTime} onChange={(e) => set("reportingTime", e.target.value)} error={errors.reportingTime?.[0]} disabled={saving} required />
        {select("vendorId", "Vendor / Sponsor", vendors.map((v) => ({ value: v.id, label: v.name })), "Select the vendor")}
        <TextField label="Cost (₹, internal)" name="cost" type="number" step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} error={errors.cost?.[0]} disabled={saving} required />
        <TextField label="Selling Price (₹, internal)" name="sellingPrice" type="number" step="0.01" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} error={errors.sellingPrice?.[0]} disabled={saving} required />
      </div>
      <div className="mt-4">
        <Textarea
          label="Instructions for the customer (optional)"
          name="instructions"
          rows={3}
          value={form.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          error={errors.instructions?.[0]}
          disabled={saving}
          hint="Printed on the package PDF."
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!allFilled}>
          {existing ? "Update A2A Details" : "Confirm A2A Details"}
        </Button>
      </div>
    </section>
  );
}
