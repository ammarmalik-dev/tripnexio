"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface BorderOption {
  id: string;
  name: string;
}

interface BorderOperationalDetails {
  borderId: string;
  borderName: string;
  pickupLocation: string;
  reportingTime: string;
  pickupPersonName: string;
  customerContactNumber: string;
}

interface VisaChangeBorderDetailsPanelProps {
  leadId: string;
  existing?: BorderOperationalDetails;
  onSaved: (details: BorderOperationalDetails) => void;
}

const EMPTY_FORM = { borderId: "", pickupLocation: "", reportingTime: "", pickupPersonName: "", customerContactNumber: "" };

/**
 * Visa_Change.md §9/§10, Locked Rules #10-13: Pickup Location, Reporting
 * Time, Pickup Person Name, and Customer Contact Number are all mandatory
 * for a Border Exit package — enforced here as one all-or-nothing save
 * (the API route rejects a partial submission), so a future package-
 * generation step can trust this data is complete whenever it exists.
 */
export function VisaChangeBorderDetailsPanel({ leadId, existing, onSaved }: VisaChangeBorderDetailsPanelProps) {
  const [borders, setBorders] = useState<BorderOption[]>([]);
  const [form, setForm] = useState(
    existing
      ? {
          borderId: existing.borderId,
          pickupLocation: existing.pickupLocation,
          reportingTime: existing.reportingTime,
          pickupPersonName: existing.pickupPersonName,
          customerContactNumber: existing.customerContactNumber,
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<BorderOption[]>("/api/borders");
        if (!cancelled) setBorders(result);
      } catch {
        // The select just stays empty — not worth a toast for a background list load.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const result = await patchJson<{ borderOperationalDetails: BorderOperationalDetails }>(
        `/api/leads/${leadId}/visa-change-border-details`,
        form
      );
      toast.success("Border operational details confirmed.");
      onSaved(result.borderOperationalDetails);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save these details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const allFilled = form.borderId && form.pickupLocation && form.reportingTime && form.pickupPersonName && form.customerContactNumber;

  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink-heading">Border Operational Details</h2>
      <p className="mb-4 text-xs text-ink-tertiary">
        All four fields are mandatory before this can count as a confirmed Border Exit package — the customer never
        enters these themselves.
      </p>

      {existing ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Confirmed: {existing.borderName}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Border Crossing" htmlFor="borderId" error={errors.borderId?.[0]}>
          <select
            id="borderId"
            value={form.borderId}
            disabled={saving}
            onChange={(event) => setForm({ ...form, borderId: event.target.value })}
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
        <TextField
          label="Pickup Location"
          name="pickupLocation"
          value={form.pickupLocation}
          onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })}
          error={errors.pickupLocation?.[0]}
          disabled={saving}
        />
        <TextField
          label="Reporting Time"
          name="reportingTime"
          placeholder="e.g. 6:00 AM"
          value={form.reportingTime}
          onChange={(e) => setForm({ ...form, reportingTime: e.target.value })}
          error={errors.reportingTime?.[0]}
          disabled={saving}
        />
        <TextField
          label="Pickup Person Name"
          name="pickupPersonName"
          value={form.pickupPersonName}
          onChange={(e) => setForm({ ...form, pickupPersonName: e.target.value })}
          error={errors.pickupPersonName?.[0]}
          disabled={saving}
        />
        <TextField
          label="Customer Contact Number"
          name="customerContactNumber"
          value={form.customerContactNumber}
          onChange={(e) => setForm({ ...form, customerContactNumber: e.target.value })}
          error={errors.customerContactNumber?.[0]}
          disabled={saving}
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
