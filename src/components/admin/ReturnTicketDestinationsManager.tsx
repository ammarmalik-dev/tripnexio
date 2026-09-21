"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import {
  RETURN_TICKET_VISA_TYPES,
  RETURN_TICKET_VISA_TYPE_LABELS,
  type ReturnTicketVisaType,
} from "@/lib/leads/compute-return-date";

interface DestinationData {
  id: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  ratePerApplicant: number;
  validityOptions: ReturnTicketVisaType[];
  active: boolean;
  displayOrder: number;
}

interface CountryData {
  id: string;
  name: string;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;

interface FormState {
  rate: string;
  validity: ReturnTicketVisaType[];
  displayOrder: string;
}

function toFormState(d: DestinationData): FormState {
  return { rate: String(d.ratePerApplicant), validity: d.validityOptions, displayOrder: String(d.displayOrder) };
}

function toPayload(form: FormState) {
  return {
    ratePerApplicant: Number(form.rate),
    validityOptions: form.validity,
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function RateFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: FieldErrors;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Rate per applicant (₹)"
        name="rate"
        type="number"
        min={0}
        value={form.rate}
        onChange={(event) => onChange({ ...form, rate: event.target.value })}
        error={errors.ratePerApplicant?.[0]}
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
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="text-sm font-medium text-ink-primary">Visa validity options offered</legend>
        <div className="flex flex-wrap gap-4">
          {RETURN_TICKET_VISA_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={form.validity.includes(type)}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...form,
                    validity: event.target.checked ? [...form.validity, type] : form.validity.filter((v) => v !== type),
                  })
                }
              />
              {RETURN_TICKET_VISA_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
        {errors.validityOptions?.[0] ? <span className="text-xs text-error">{errors.validityOptions[0]}</span> : null}
      </fieldset>
    </div>
  );
}

function DestinationCard({ destination, onSaved }: { destination: DestinationData; onSaved: (d: DestinationData) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(destination));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(destination));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<DestinationData>(
        `/api/admin/return-ticket-destinations/${destination.id}`,
        toPayload(form)
      );
      toast.success(`${updated.countryName} updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this destination. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const updated = await patchJson<DestinationData>(`/api/admin/return-ticket-destinations/${destination.id}`, {
        active: !destination.active,
      });
      toast.success(updated.active ? `${updated.countryName} enabled.` : `${updated.countryName} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this destination. Please try again.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-heading">{destination.countryName}</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              destination.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
            )}
          >
            {destination.active ? "Active" : "Disabled"}
          </span>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggle()} isLoading={toggling}>
          {destination.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <RateFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewDestinationForm({
  availableCountries,
  onCreated,
}: {
  availableCountries: CountryData[];
  onCreated: (d: DestinationData) => void;
}) {
  const [countryId, setCountryId] = useState("");
  const [form, setForm] = useState<FormState>({ rate: "", validity: [...RETURN_TICKET_VISA_TYPES], displayOrder: "0" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<DestinationData>("/api/admin/return-ticket-destinations", {
        countryId,
        ...toPayload(form),
      });
      toast.success(`${created.countryName} added.`);
      onCreated(created);
      setCountryId("");
      setForm({ rate: "", validity: [...RETURN_TICKET_VISA_TYPES], displayOrder: "0" });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this destination. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Add Destination</h2>
      <SelectField
        label="Country"
        name="countryId"
        placeholder={availableCountries.length ? "Select a country" : "All countries already added"}
        options={availableCountries.map((c) => ({ value: c.id, label: c.name }))}
        value={countryId}
        onChange={(event) => setCountryId(event.target.value)}
        error={errors.countryId?.[0]}
        disabled={creating || availableCountries.length === 0}
      />
      <RateFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          isLoading={creating}
          disabled={!countryId || form.rate === ""}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Destination
        </Button>
      </div>
    </div>
  );
}

export function ReturnTicketDestinationsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [destinations, setDestinations] = useState<DestinationData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [destinationList, countryList] = await Promise.all([
          getJson<DestinationData[]>("/api/admin/return-ticket-destinations"),
          getJson<CountryData[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setDestinations(destinationList);
        setCountries(countryList);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load destinations. Please try again.");
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
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load destinations"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const usedCountryIds = new Set(destinations.map((d) => d.countryId));
  const availableCountries = countries.filter((c) => c.active && !usedCountryIds.has(c.id));

  return (
    <div className="flex flex-col gap-4">
      {destinations.length === 0 ? (
        <EmptyState title="No destinations yet" description="Add the first destination using the form below." />
      ) : (
        destinations.map((destination) => (
          <DestinationCard
            key={destination.id}
            destination={destination}
            onSaved={(updated) => setDestinations((current) => current.map((d) => (d.id === updated.id ? updated : d)))}
          />
        ))
      )}
      <NewDestinationForm
        availableCountries={availableCountries}
        onCreated={(created) => setDestinations((current) => [...current, created])}
      />
    </div>
  );
}
