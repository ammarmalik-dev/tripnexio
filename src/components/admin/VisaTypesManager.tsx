"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface CountryOption {
  id: string;
  name: string;
}

interface VisaTypeData {
  id: string;
  name: string;
  countryId: string | null;
  country: CountryOption | null;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

function CountrySelect({
  id,
  value,
  countries,
  onChange,
  disabled,
  error,
}: {
  id: string;
  value: string;
  countries: CountryOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <FormField label="Destination country" htmlFor={id} error={error}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(!!error))}
      >
        <option value="">All countries</option>
        {countries.map((country) => (
          <option key={country.id} value={country.id}>
            {country.name}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function VisaTypeRow({
  visaType,
  countries,
  onSaved,
  onDeleted,
}: {
  visaType: VisaTypeData;
  countries: CountryOption[];
  onSaved: (v: VisaTypeData) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(visaType.name);
  const [countryId, setCountryId] = useState(visaType.countryId ?? "");
  const [order, setOrder] = useState(String(visaType.displayOrder));
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dirty =
    name.trim() !== visaType.name ||
    (countryId || null) !== visaType.countryId ||
    (Number(order) || 0) !== visaType.displayOrder;

  const save = async (patch: { name?: string; countryId?: string | null; displayOrder?: number; active?: boolean }) => {
    setBusy(true);
    setError(undefined);
    try {
      const updated = await patchJson<VisaTypeData>(`/api/admin/visa-types/${visaType.id}`, patch);
      toast.success(`"${updated.name}" updated.`);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name[0]);
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this visa type. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteJson(`/api/admin/visa-types/${visaType.id}`);
      toast.success(`"${visaType.name}" removed.`);
      onDeleted(visaType.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove this visa type. Please try again.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 lg:flex-row lg:items-end">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_100px]">
        <TextField label="Visa type" name={`name-${visaType.id}`} value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={busy} />
        <CountrySelect id={`country-${visaType.id}`} value={countryId} countries={countries} onChange={setCountryId} disabled={busy} />
        <TextField label="Order" name={`order-${visaType.id}`} type="number" value={order} onChange={(e) => setOrder(e.target.value)} disabled={busy} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            visaType.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {visaType.active ? "Active" : "Hidden"}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={() => void save({ name: name.trim(), countryId: countryId || null, displayOrder: Number(order) || 0 })}
          disabled={!dirty || busy}
        >
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void save({ active: !visaType.active })} disabled={busy}>
          {visaType.active ? "Hide" : "Show"}
        </Button>
        {confirming ? (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Keep
            </Button>
            <Button type="button" size="sm" onClick={() => void remove()} isLoading={busy}>
              Confirm remove
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={busy}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function NewVisaTypeForm({ countries, onCreated }: { countries: CountryOption[]; onCreated: (v: VisaTypeData) => void }) {
  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    setError(undefined);
    try {
      const created = await postJson<VisaTypeData>("/api/admin/visa-types", { name: name.trim(), countryId: countryId || null });
      toast.success(`"${created.name}" added.`);
      onCreated(created);
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name[0]);
      toast.error(err instanceof ApiError ? err.message : "Couldn't add this visa type. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4 lg:flex-row lg:items-end">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="New visa type" name="new-visa-type" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={creating} />
        <CountrySelect id="new-visa-type-country" value={countryId} countries={countries} onChange={setCountryId} disabled={creating} />
      </div>
      <Button type="button" size="sm" onClick={() => void create()} isLoading={creating} disabled={name.trim().length < 2}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add
      </Button>
    </div>
  );
}

export function VisaTypesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<VisaTypeData[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [visaTypes, countryRows] = await Promise.all([
          getJson<VisaTypeData[]>("/api/admin/visa-types"),
          getJson<CountryOption[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setItems(visaTypes);
        setCountries(countryRows.map((country) => ({ id: country.id, name: country.name })));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load visa types. Please try again.");
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
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load visa types"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <EmptyState
          title="No visa types yet"
          description="Until one is added, the New Visa form skips the Visa Type question and your team confirms it with the customer."
        />
      ) : (
        items.map((item) => (
          <VisaTypeRow
            key={item.id}
            visaType={item}
            countries={countries}
            onSaved={(updated) => setItems((current) => current.map((v) => (v.id === updated.id ? updated : v)))}
            onDeleted={(id) => setItems((current) => current.filter((v) => v.id !== id))}
          />
        ))
      )}
      <NewVisaTypeForm countries={countries} onCreated={(created) => setItems((current) => [...current, created])} />
    </div>
  );
}
