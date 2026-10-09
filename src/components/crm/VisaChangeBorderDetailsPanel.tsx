"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { parseOperationalBlock } from "@/lib/visa-change/operational";

interface Option {
  id: string;
  name: string;
}

interface VisaChangeBorderDetailsPanelProps {
  leadId: string;
  /** Lead.details.borderOperationalDetails as stored (may be an older, incomplete set). */
  existing?: Record<string, unknown>;
  onSaved: (details: Record<string, unknown>) => void;
}

const FIELDS = [
  "borderId",
  "pickupLocation",
  "vehicleNumber",
  "reportingTime",
  "travelTime",
  "pickupPersonName",
  "customerContactNumber",
  "pickupPersonContact",
  "dropLocation",
  "busOperator",
  "vendorId",
  "instructions",
] as const;
type FieldName = (typeof FIELDS)[number];
const REQUIRED: FieldName[] = ["borderId", "pickupLocation", "reportingTime", "travelTime", "pickupPersonName", "customerContactNumber"];

/**
 * Visa_Change.md §9/§10, Locked Rules #10-13 (P14): the Border Exit
 * operational details — mandatory before quoting and printed on the package
 * PDF. Saved all-or-nothing; the API rejects a partial set.
 */
export function VisaChangeBorderDetailsPanel({ leadId, existing, onSaved }: VisaChangeBorderDetailsPanelProps) {
  const [borders, setBorders] = useState<Option[]>([]);
  const [vendors, setVendors] = useState<Option[]>([]);
  const [form, setForm] = useState<Record<FieldName, string>>(
    () => Object.fromEntries(FIELDS.map((field) => [field, typeof existing?.[field] === "string" ? (existing[field] as string) : ""])) as Record<FieldName, string>
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const complete = parseOperationalBlock(existing);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [borderList, vendorList] = await Promise.all([
          getJson<Option[]>("/api/borders"),
          getJson<Option[]>("/api/vendors?service=VISA_CHANGE"),
        ]);
        if (cancelled) return;
        setBorders(borderList);
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
      const result = await patchJson<{ borderOperationalDetails: Record<string, unknown> }>(`/api/leads/${leadId}/visa-change-border-details`, form);
      toast.success("Border operational details confirmed.");
      onSaved(result.borderOperationalDetails);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save these details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const allFilled = REQUIRED.every((field) => form[field].trim());
  const text = (field: FieldName, label: string, extra: { placeholder?: string; hint?: string } = {}) => (
    <TextField
      label={label}
      name={field}
      value={form[field]}
      onChange={(e) => set(field, e.target.value)}
      error={errors[field]?.[0]}
      disabled={saving}
      required={REQUIRED.includes(field)}
      {...extra}
    />
  );

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-heading">Border Exit Operational Details</h2>
      <p className="mb-4 text-xs text-ink-tertiary">
        Required before this lead can be quoted, and printed on the customer&apos;s package PDF. The customer never enters these.
      </p>

      {complete ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Confirmed: {complete.kind === "BORDER" ? complete.borderName : ""}
        </div>
      ) : existing ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Saved details are incomplete (e.g. travel time missing) — update them before quoting.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Border Crossing" htmlFor="borderId" error={errors.borderId?.[0]} required>
          <select
            id="borderId"
            value={form.borderId}
            disabled={saving}
            onChange={(event) => set("borderId", event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.borderId))}
          >
            <option value="" disabled>
              Select a border crossing
            </option>
            {borders.map((border) => (
              <option key={border.id} value={border.id}>
                {border.name}
              </option>
            ))}
          </select>
        </FormField>
        {text("pickupLocation", "Pickup Location")}
        {/* Client testing 2026-10-09 (B34) — no separate pickup address; the pickup location covers it. */}
        {text("vehicleNumber", "Vehicle Number (optional)")}
        {text("reportingTime", "Reporting Time", { placeholder: "e.g. 6:00 AM" })}
        {text("travelTime", "Departure / Travel Time", { placeholder: "e.g. 7:00 AM" })}
        {text("pickupPersonName", "Pickup Person Name")}
        {text("customerContactNumber", "Customer Contact Number")}
        {text("pickupPersonContact", "Pickup Person Contact (optional)")}
        {text("dropLocation", "Drop / Border Location (optional)")}
        {text("busOperator", "Bus / Operator (optional)")}
        <FormField label="Vendor / Sponsor (optional)" htmlFor="border-vendorId" error={errors.vendorId?.[0]}>
          <select
            id="border-vendorId"
            value={form.vendorId}
            disabled={saving}
            onChange={(event) => set("vendorId", event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.vendorId))}
          >
            <option value="">None</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </FormField>
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
          {existing ? "Update Border Details" : "Confirm Border Details"}
        </Button>
      </div>
    </section>
  );
}
