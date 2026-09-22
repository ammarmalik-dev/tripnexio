"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface AirlineData {
  id: string;
  name: string;
  code: string;
  country: string;
  otbRequired: boolean;
  normalPrice: string | null;
  urgentPrice: string | null;
  standardProcessingDays: number | null;
  urgentProcessingHours: number | null;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface AirlineFormState {
  name: string;
  code: string;
  country: string;
  otbRequired: boolean;
  normalPrice: string;
  urgentPrice: string;
  standardProcessingDays: string;
  urgentProcessingHours: string;
  displayOrder: string;
}

const EMPTY_FORM: AirlineFormState = {
  name: "",
  code: "",
  country: "",
  otbRequired: false,
  normalPrice: "",
  urgentPrice: "",
  standardProcessingDays: "",
  urgentProcessingHours: "",
  displayOrder: "0",
};

function toFormState(airline: AirlineData): AirlineFormState {
  return {
    name: airline.name,
    code: airline.code,
    country: airline.country,
    otbRequired: airline.otbRequired,
    normalPrice: airline.normalPrice ?? "",
    urgentPrice: airline.urgentPrice ?? "",
    standardProcessingDays: airline.standardProcessingDays === null ? "" : String(airline.standardProcessingDays),
    urgentProcessingHours: airline.urgentProcessingHours === null ? "" : String(airline.urgentProcessingHours),
    displayOrder: String(airline.displayOrder),
  };
}

function AirlineFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: AirlineFormState;
  onChange: (next: AirlineFormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Name"
        name="name"
        value={form.name}
        onChange={(event) => onChange({ ...form, name: event.target.value })}
        error={errors.name?.[0]}
        disabled={disabled}
      />
      <TextField
        label="IATA Code"
        name="code"
        placeholder="e.g. EK"
        value={form.code}
        onChange={(event) => onChange({ ...form, code: event.target.value.toUpperCase() })}
        error={errors.code?.[0]}
        disabled={disabled}
        maxLength={3}
      />
      <TextField
        label="Country"
        name="country"
        value={form.country}
        onChange={(event) => onChange({ ...form, country: event.target.value })}
        error={errors.country?.[0]}
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
      <TextField
        label="Normal Processing Price (₹)"
        name="normalPrice"
        type="number"
        step="0.01"
        placeholder="Optional"
        value={form.normalPrice}
        onChange={(event) => onChange({ ...form, normalPrice: event.target.value })}
        error={errors.normalPrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Urgent Processing Price (₹)"
        name="urgentPrice"
        type="number"
        step="0.01"
        placeholder="Optional"
        value={form.urgentPrice}
        onChange={(event) => onChange({ ...form, urgentPrice: event.target.value })}
        error={errors.urgentPrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Standard OTB processing (working days)"
        name="standardProcessingDays"
        type="number"
        min={1}
        placeholder="Uses the default"
        hint="Optional — overrides Admin → OTB Timelines for this airline."
        value={form.standardProcessingDays}
        onChange={(event) => onChange({ ...form, standardProcessingDays: event.target.value })}
        error={errors.standardProcessingDays?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Urgent OTB processing (working hours)"
        name="urgentProcessingHours"
        type="number"
        min={0}
        placeholder="Uses the default"
        hint="Optional — overrides the default for this airline."
        value={form.urgentProcessingHours}
        onChange={(event) => onChange({ ...form, urgentProcessingHours: event.target.value })}
        error={errors.urgentProcessingHours?.[0]}
        disabled={disabled}
      />
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={form.otbRequired}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, otbRequired: event.target.checked })}
        />
        OTB (Ok to Board) required for this airline
      </label>
    </div>
  );
}

function buildPayload(form: AirlineFormState) {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    country: form.country.trim(),
    otbRequired: form.otbRequired,
    normalPrice: form.normalPrice.trim() === "" ? undefined : Number(form.normalPrice),
    urgentPrice: form.urgentPrice.trim() === "" ? undefined : Number(form.urgentPrice),
    standardProcessingDays: form.standardProcessingDays.trim() === "" ? null : Number(form.standardProcessingDays),
    urgentProcessingHours: form.urgentProcessingHours.trim() === "" ? null : Number(form.urgentProcessingHours),
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function AirlineCard({ airline, onSaved }: { airline: AirlineData; onSaved: (airline: AirlineData) => void }) {
  const [form, setForm] = useState<AirlineFormState>(toFormState(airline));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(airline));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<AirlineData>(`/api/admin/airlines/${airline.id}`, buildPayload(form));
      toast.success(`Airline "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this airline. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<AirlineData>(`/api/admin/airlines/${airline.id}`, { active: !airline.active });
      toast.success(updated.active ? `${updated.name} enabled.` : `${updated.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this airline. Please try again.");
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
            airline.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {airline.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {airline.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <AirlineFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewAirlineForm({ onCreated }: { onCreated: (airline: AirlineData) => void }) {
  const [form, setForm] = useState<AirlineFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<AirlineData>("/api/admin/airlines", buildPayload(form));
      toast.success(`Airline "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this airline. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.name.trim() && form.code.trim() && form.country.trim();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Airline</h2>
      <AirlineFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Airline
        </Button>
      </div>
    </div>
  );
}

export function AirlinesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [airlines, setAirlines] = useState<AirlineData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<AirlineData[]>("/api/admin/airlines");
        if (cancelled) return;
        setAirlines(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load airlines. Please try again.");
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
        title="Couldn't load airlines"
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
      {airlines.length === 0 ? (
        <EmptyState title="No airlines yet" description="Add the first one using the form below." />
      ) : (
        airlines.map((airline) => (
          <AirlineCard
            key={airline.id}
            airline={airline}
            onSaved={(updated) => setAirlines((current) => current.map((a) => (a.id === updated.id ? updated : a)))}
          />
        ))
      )}
      <NewAirlineForm onCreated={(created) => setAirlines((current) => [...current, created])} />
    </div>
  );
}
