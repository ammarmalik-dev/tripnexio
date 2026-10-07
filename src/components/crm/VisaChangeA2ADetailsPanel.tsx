"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, PlaneLanding, PlaneTakeoff } from "lucide-react";
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

const TEXT_FIELDS = [
  "exitAirportId",
  "airlineCode",
  "flightNumber",
  "flightDate",
  "flightTime",
  "entryAirportId",
  "returnAirlineCode",
  "returnFlightNumber",
  "returnFlightDate",
  "returnFlightTime",
  "reportingTime",
  "vendorId",
  "cost",
  "sellingPrice",
  "instructions",
] as const;
type FieldName = (typeof TEXT_FIELDS)[number];
const REQUIRED: FieldName[] = TEXT_FIELDS.filter((field) => field !== "instructions");

/**
 * Client corrections 2026-10-05 §8 — the Airport-to-Airport round-trip
 * itinerary is the A2A operational record: onward flight out of the exit
 * airport, return flight back to the re-entry airport, both from the
 * Airport / Airline masters (no free text). Required before quoting; every
 * quotation option carries it, and it prints on the package PDF. Vendor,
 * cost and selling price stay internal.
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

  const set = (field: FieldName, value: string) =>
    setForm((current) => {
      const next = { ...current, [field]: value };
      // A round trip usually comes back to the airport it left from, on the same airline — prefill, still editable.
      if (field === "exitAirportId" && !current.entryAirportId) next.entryAirportId = value;
      if (field === "airlineCode" && !current.returnAirlineCode) next.returnAirlineCode = value;
      return next;
    });

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const result = await patchJson<{ a2aOperationalDetails: Record<string, unknown> }>(`/api/leads/${leadId}/visa-change-a2a-details`, {
        ...form,
        cost: Number(form.cost),
        sellingPrice: Number(form.sellingPrice),
      });
      toast.success("Round-trip itinerary confirmed.");
      onSaved(result.a2aOperationalDetails);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the itinerary. Please try again.");
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
  const airlineOptions = airlines.map((a) => ({ value: a.code ?? a.id, label: `${a.name}${a.code ? ` (${a.code})` : ""}` }));
  const text = (field: FieldName, label: string, props: { type?: string; placeholder?: string; step?: string } = {}) => (
    <TextField
      label={label}
      name={field}
      value={form[field]}
      onChange={(e) => set(field, e.target.value)}
      error={errors[field]?.[0]}
      disabled={saving}
      required
      {...props}
    />
  );

  return (
    <section className="glass-2 rounded-xl p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-heading">Round-trip Itinerary (Airport-to-Airport)</h2>
      <p className="mb-4 text-xs text-ink-tertiary">
        The A2A operational record: required before quoting, shown on every quotation option and printed on the package PDF. Vendor, cost and
        selling price stay internal.
      </p>

      {complete && complete.kind === "A2A" ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Confirmed: out {complete.exitAirport}, {complete.airline} {complete.flightNumber} on {complete.flightDate}
            {complete.returnFlightNumber
              ? ` · back to ${complete.entryAirport}, ${complete.returnAirline ?? complete.airline} ${complete.returnFlightNumber} on ${complete.returnFlightDate}`
              : " · return flight not recorded yet"}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <fieldset className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-3">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-ink-accent uppercase">
            <PlaneTakeoff className="h-3.5 w-3.5" aria-hidden="true" />
            Onward (exit)
          </legend>
          {select("exitAirportId", "Exit Airport", exitAirports.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })), "Select the exit airport")}
          {select("airlineCode", "Airline", airlineOptions, "Select the airline")}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {text("flightNumber", "Flight Number")}
            <DateField label="Date" name="flightDate" value={form.flightDate} onChange={(e) => set("flightDate", e.target.value)} error={errors.flightDate?.[0]} disabled={saving} />
            {text("flightTime", "Time", { type: "time" })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-1 p-3">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-ink-accent uppercase">
            <PlaneLanding className="h-3.5 w-3.5" aria-hidden="true" />
            Return (re-entry)
          </legend>
          {select("entryAirportId", "Re-entry Airport", entryAirports.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })), "Select the re-entry airport")}
          {select("returnAirlineCode", "Airline", airlineOptions, "Select the airline")}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {text("returnFlightNumber", "Flight Number")}
            <DateField
              label="Date"
              name="returnFlightDate"
              value={form.returnFlightDate}
              onChange={(e) => set("returnFlightDate", e.target.value)}
              error={errors.returnFlightDate?.[0]}
              disabled={saving}
            />
            {text("returnFlightTime", "Time", { type: "time" })}
          </div>
        </fieldset>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {text("reportingTime", "Reporting Time", { placeholder: "e.g. 3 hours before departure" })}
        {select("vendorId", "Vendor / Sponsor", vendors.map((v) => ({ value: v.id, label: v.name })), "Select the vendor")}
        {text("cost", "Cost (₹, internal)", { type: "number", step: "0.01" })}
        {text("sellingPrice", "Selling Price (₹, internal)", { type: "number", step: "0.01" })}
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
          {existing ? "Update Itinerary" : "Confirm Itinerary"}
        </Button>
      </div>
    </section>
  );
}
