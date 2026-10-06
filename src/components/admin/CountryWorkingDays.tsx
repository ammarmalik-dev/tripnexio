"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { toast } from "@/components/ui/Toaster";
import { ApiError, getJson, patchJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface CountryRow {
  id: string;
  name: string;
  active: boolean;
  weekendDays: string | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Client corrections 2026-10-05 — working days per enabled country (not just
 * India and the UAE): pick a country, tick its weekend days, Save. "Default"
 * means the System Configuration weekend applies. Newly enabled countries
 * appear automatically.
 */
export function CountryWorkingDays() {
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [countryId, setCountryId] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = (await getJson<CountryRow[]>("/api/admin/countries")).filter((row) => row.active);
        if (cancelled) return;
        setCountries(rows);
        if (rows[0]) {
          setCountryId(rows[0].id);
          setDays(rows[0].weekendDays ? rows[0].weekendDays.split(",").map(Number) : []);
        }
      } catch {
        // Panel stays empty.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = countries.find((row) => row.id === countryId) ?? null;
  const pick = (id: string) => {
    setCountryId(id);
    const row = countries.find((entry) => entry.id === id);
    setDays(row?.weekendDays ? row.weekendDays.split(",").map(Number) : []);
  };

  const save = async (useDefault: boolean) => {
    if (!selected) return;
    setSaving(true);
    try {
      const weekendDays = useDefault ? null : [...days].sort().join(",") || null;
      const updated = await patchJson<CountryRow>(`/api/admin/countries/${selected.id}`, { weekendDays });
      setCountries((current) => current.map((row) => (row.id === updated.id ? { ...row, weekendDays: updated.weekendDays } : row)));
      if (useDefault) setDays([]);
      toast.success(`${selected.name}: working days saved.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the working days.");
    } finally {
      setSaving(false);
    }
  };

  if (countries.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink-heading">Working days by country</h2>
        <p className="text-xs text-ink-tertiary">Tick the weekend (non-working) days. Holidays for the country are added below.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Country"
          value={countryId}
          onChange={(event) => pick(event.target.value)}
          className={cn(fieldControlClass, fieldBorderClass(false), "h-10 w-auto min-w-[200px]")}
        >
          {countries.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
              {row.weekendDays ? "" : " (default)"}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekend days">
          {DAYS.map((label, day) => {
            const on = days.includes(day);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => setDays((current) => (on ? current.filter((d) => d !== day) : [...current, day]))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  on ? "border-transparent bg-ink-heading text-white" : "border-hairline text-ink-secondary hover:text-ink-primary"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <Button type="button" size="sm" onClick={() => void save(false)} isLoading={saving} disabled={days.length === 0}>
          Save
        </Button>
        {selected?.weekendDays ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => void save(true)} disabled={saving}>
            Use default
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-ink-tertiary">
        {selected?.weekendDays ? `Weekend: ${selected.weekendDays.split(",").map((d) => DAYS[Number(d)]).join(", ")}` : "Uses the System Configuration weekend."}
      </p>
    </section>
  );
}
