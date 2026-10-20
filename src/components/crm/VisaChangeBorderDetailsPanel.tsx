"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { Button } from "@/components/ui/Button";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

export interface BorderTripView {
  borderName: string;
  pickupLocation: string;
  vehicleNumber: string;
  reportingTime: string;
  travelTime: string;
  pickupPersonName: string;
  pickupPersonContact: string;
  instructions: string;
  complete: boolean;
}

const FIELDS = ["pickupLocation", "vehicleNumber", "reportingTime", "travelTime", "pickupPersonName", "pickupPersonContact", "instructions"] as const;
type FieldName = (typeof FIELDS)[number];
const REQUIRED: FieldName[] = ["pickupLocation", "reportingTime", "travelTime", "pickupPersonName"];

/**
 * Client doc 2026-10-20 (D8) — a Border Exit booking's trip details, entered after payment from the vendor
 * (each vendor has its own): pickup location, vehicle number, reporting and travel time, pickup person and
 * contact, instructions. The border comes from the paid option. Printed on the package PDF.
 */
export function VisaChangeBorderDetailsPanel({ leadId, border, onSaved }: { leadId: string; border: BorderTripView; onSaved: () => void }) {
  const [form, setForm] = useState<Record<FieldName, string>>(() => Object.fromEntries(FIELDS.map((field) => [field, border[field] ?? ""])) as Record<FieldName, string>);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  const set = (field: FieldName, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await patchJson(`/api/leads/${leadId}/visa-change-border-details`, form);
      toast.success("Border trip details saved.");
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save these details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const text = (field: FieldName, label: string, extra: { placeholder?: string } = {}) => (
    <TextField
      label={label}
      name={`border-${field}`}
      value={form[field]}
      onChange={(event) => set(field, event.target.value)}
      error={errors[field]?.[0]}
      disabled={saving}
      required={REQUIRED.includes(field)}
      {...extra}
    />
  );

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-heading">Border trip details — {border.borderName}</h2>
      <p className="mb-4 text-xs text-ink-tertiary">From the vendor, after payment. Printed on the customer&apos;s package PDF.</p>
      {border.complete ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Trip details saved — the package can be generated.
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Enter the trip details before generating the package.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {text("pickupLocation", "Pickup Location")}
        {text("vehicleNumber", "Vehicle Number (optional)")}
        {text("reportingTime", "Reporting Time", { placeholder: "e.g. 6:00 AM" })}
        {text("travelTime", "Departure / Travel Time", { placeholder: "e.g. 7:00 AM" })}
        {text("pickupPersonName", "Pickup Person Name")}
        {text("pickupPersonContact", "Pickup Person Contact (optional)")}
      </div>
      <div className="mt-4">
        <Textarea
          label="Instructions for the customer (optional)"
          name="border-instructions"
          rows={3}
          value={form.instructions}
          onChange={(event) => set("instructions", event.target.value)}
          error={errors.instructions?.[0]}
          disabled={saving}
          hint="Printed on the package PDF."
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" size="sm" onClick={() => void save()} isLoading={saving} disabled={REQUIRED.some((field) => !form[field].trim())}>
          Save trip details
        </Button>
      </div>
    </section>
  );
}
