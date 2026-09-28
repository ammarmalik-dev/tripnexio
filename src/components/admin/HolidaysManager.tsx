"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

type HolidayCountry = "INDIA" | "UAE";

interface HolidayData {
  id: string;
  date: string;
  country: HolidayCountry;
  name: string;
  active: boolean;
}

const COUNTRY_LABELS: Record<HolidayCountry, string> = { INDIA: "India", UAE: "UAE" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function HolidayRow({ holiday, onSaved }: { holiday: HolidayData; onSaved: (h: HolidayData) => void }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = await patchJson<HolidayData>(`/api/admin/holidays/${holiday.id}`, { active: !holiday.active });
      toast.success(`"${updated.name}" ${updated.active ? "enabled" : "disabled"}.`);
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this holiday. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-primary">{holiday.name}</p>
        <p className="text-xs text-ink-tertiary">
          {formatDate(holiday.date)} · {COUNTRY_LABELS[holiday.country]}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", holiday.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
          {holiday.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void toggle()} isLoading={busy}>
          {holiday.active ? "Disable" : "Enable"}
        </Button>
      </div>
    </div>
  );
}

function NewHolidayForm({ onCreated }: { onCreated: (h: HolidayData) => void }) {
  const [date, setDate] = useState("");
  const [country, setCountry] = useState<HolidayCountry>("INDIA");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<HolidayData>("/api/admin/holidays", { date, country, name: name.trim() });
      toast.success(`"${created.name}" added.`);
      onCreated(created);
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : "Couldn't add this holiday. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4 lg:flex-row lg:items-end">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Date" name="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date?.[0]} disabled={creating} />
        <FormField label="Country" htmlFor="holiday-country" error={errors.country?.[0]}>
          <select
            id="holiday-country"
            value={country}
            disabled={creating}
            onChange={(e) => setCountry(e.target.value as HolidayCountry)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.country))}
          >
            <option value="INDIA">India</option>
            <option value="UAE">UAE</option>
          </select>
        </FormField>
        <TextField label="Holiday name" name="holiday-name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name?.[0]} disabled={creating} />
      </div>
      <Button type="button" size="sm" onClick={() => void create()} isLoading={creating} disabled={!date || name.trim().length < 2}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add
      </Button>
    </div>
  );
}

export function HolidaysManager() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [items, setItems] = useState<HolidayData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<HolidayData[]>(`/api/admin/holidays?year=${year}`);
        if (cancelled) return;
        setItems(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load holidays. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [year, reloadNonce]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
          ‹
        </Button>
        <span className="text-sm font-semibold text-ink-heading">{year}</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
          ›
        </Button>
      </div>
      {state === "loading" ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load holidays"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState title={`No holidays for ${year}`} description="Add each public holiday below — nothing is pre-filled." />
      ) : (
        items.map((item) => (
          <HolidayRow key={item.id} holiday={item} onSaved={(updated) => setItems((current) => current.map((h) => (h.id === updated.id ? updated : h)))} />
        ))
      )}
      <NewHolidayForm
        onCreated={(created) => {
          if (new Date(created.date).getUTCFullYear() === year) {
            setItems((current) => [...current, created].sort((a, b) => a.date.localeCompare(b.date)));
          }
        }}
      />
    </div>
  );
}
