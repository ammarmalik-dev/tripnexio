"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { GCC_COUNTRY_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { GccCountry } from "../../generated/prisma/enums";

interface BorderData {
  id: string;
  name: string;
  side: GccCountry;
  uaeLocation: string;
  destinationLocation: string;
  activeForVisaChange: boolean;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface BorderFormState {
  name: string;
  side: GccCountry | "";
  uaeLocation: string;
  destinationLocation: string;
  activeForVisaChange: boolean;
  displayOrder: string;
}

const EMPTY_FORM: BorderFormState = {
  name: "",
  side: "",
  uaeLocation: "",
  destinationLocation: "",
  activeForVisaChange: true,
  displayOrder: "0",
};

function toFormState(border: BorderData): BorderFormState {
  return {
    name: border.name,
    side: border.side,
    uaeLocation: border.uaeLocation,
    destinationLocation: border.destinationLocation,
    activeForVisaChange: border.activeForVisaChange,
    displayOrder: String(border.displayOrder),
  };
}

function BorderFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: BorderFormState;
  onChange: (next: BorderFormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Crossing Name"
        name="name"
        value={form.name}
        onChange={(event) => onChange({ ...form, name: event.target.value })}
        error={errors.name?.[0]}
        disabled={disabled}
      />
      <FormField label="Non-UAE Side" htmlFor="side" error={errors.side?.[0]}>
        <select
          id="side"
          value={form.side}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, side: event.target.value as GccCountry })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.side))}
        >
          <option value="" disabled>
            Select a country
          </option>
          {GCC_COUNTRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <TextField
        label="UAE-Side Location"
        name="uaeLocation"
        value={form.uaeLocation}
        onChange={(event) => onChange({ ...form, uaeLocation: event.target.value })}
        error={errors.uaeLocation?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Destination-Side Location"
        name="destinationLocation"
        value={form.destinationLocation}
        onChange={(event) => onChange({ ...form, destinationLocation: event.target.value })}
        error={errors.destinationLocation?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Display Order"
        name="displayOrder"
        type="number"
        value={form.displayOrder}
        onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
        error={errors.displayOrder?.[0]}
        disabled={disabled}
      />
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={form.activeForVisaChange}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, activeForVisaChange: event.target.checked })}
        />
        Available for Visa Change (Border Exit)
      </label>
    </div>
  );
}

function buildPayload(form: BorderFormState) {
  return {
    name: form.name.trim(),
    side: form.side || undefined,
    uaeLocation: form.uaeLocation.trim(),
    destinationLocation: form.destinationLocation.trim(),
    activeForVisaChange: form.activeForVisaChange,
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function BorderCard({ border, onSaved }: { border: BorderData; onSaved: (border: BorderData) => void }) {
  const [form, setForm] = useState<BorderFormState>(toFormState(border));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(border));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<BorderData>(`/api/admin/borders/${border.id}`, buildPayload(form));
      toast.success(`Border crossing "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this border crossing. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<BorderData>(`/api/admin/borders/${border.id}`, { active: !border.active });
      toast.success(updated.active ? `${updated.name} enabled.` : `${updated.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this border crossing. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            border.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {border.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {border.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <BorderFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewBorderForm({ onCreated }: { onCreated: (border: BorderData) => void }) {
  const [form, setForm] = useState<BorderFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<BorderData>("/api/admin/borders", buildPayload(form));
      toast.success(`Border crossing "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this border crossing. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.name.trim() && form.side && form.uaeLocation.trim() && form.destinationLocation.trim();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Border Crossing</h2>
      <BorderFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Border Crossing
        </Button>
      </div>
    </div>
  );
}

export function BordersManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [borders, setBorders] = useState<BorderData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<BorderData[]>("/api/admin/borders");
        if (cancelled) return;
        setBorders(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load border crossings. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load border crossings"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {borders.length === 0 ? (
        <EmptyState title="No border crossings yet" description="Add the first one using the form below." />
      ) : (
        borders.map((border) => (
          <BorderCard
            key={border.id}
            border={border}
            onSaved={(updated) => setBorders((current) => current.map((b) => (b.id === updated.id ? updated : b)))}
          />
        ))
      )}
      <NewBorderForm onCreated={(created) => setBorders((current) => [...current, created])} />
    </div>
  );
}
