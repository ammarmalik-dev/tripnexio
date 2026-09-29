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

type PaxType = "ADULT" | "CHILD" | "INFANT";
const PAX_LABELS: Record<PaxType, string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };

interface OtbPriceData {
  id: string;
  airlineId: string;
  airlineName: string;
  airlineCode: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  paxType: PaxType;
  normalPrice: number;
  urgentPrice: number | null;
  active: boolean;
}

interface Option {
  id: string;
  name: string;
  active: boolean;
  otbRequired?: boolean;
  code?: string;
}

type FieldErrors = Record<string, string[] | undefined>;
type FetchState = "loading" | "success" | "error";

const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));
const toNullableNumber = (value: string) => (value.trim() === "" ? null : Number(value));

function PriceRow({ row, onSaved }: { row: OtbPriceData; onSaved: (row: OtbPriceData) => void }) {
  const initial = { normal: String(row.normalPrice), urgent: row.urgentPrice === null ? "" : String(row.urgentPrice) };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const dirty = form.normal !== initial.normal || form.urgent !== initial.urgent;

  const save = async (body: Record<string, unknown>, message: string) => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<OtbPriceData>(`/api/admin/otb-prices/${row.id}`, body);
      toast.success(message);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this price.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-heading">
          {row.airlineName} ({row.airlineCode}) → {row.countryName} · {PAX_LABELS[row.paxType]}
        </span>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", row.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
            {row.active ? "Active" : "Disabled"}
          </span>
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => void save({ active: !row.active }, row.active ? "Price disabled." : "Price enabled.")}>
            {row.active ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Normal price (₹)" name={`normal-${row.id}`} type="number" min={0} value={form.normal} onChange={(e) => setForm({ ...form, normal: e.target.value })} error={errors.normalPrice?.[0]} disabled={saving} />
        <TextField label="Urgent price (₹)" name={`urgent-${row.id}`} type="number" min={0} placeholder="Airline price" value={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.value })} error={errors.urgentPrice?.[0]} disabled={saving} />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!dirty} isLoading={saving} onClick={() => void save({ normalPrice: toNumber(form.normal), urgentPrice: toNullableNumber(form.urgent) }, "Price updated.")}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewPriceForm({ airlines, countries, onCreated }: { airlines: Option[]; countries: Option[]; onCreated: (row: OtbPriceData) => void }) {
  const empty = { airlineId: "", countryId: "", paxType: "ADULT", normal: "", urgent: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<OtbPriceData>("/api/admin/otb-prices", {
        airlineId: form.airlineId,
        countryId: form.countryId,
        paxType: form.paxType,
        normalPrice: toNumber(form.normal),
        urgentPrice: toNullableNumber(form.urgent),
      });
      toast.success("OTB price added.");
      onCreated(created);
      setForm(empty);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this price.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Add OTB price</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField label="Airline" name="otb-price-airline" placeholder="Select an airline" options={airlines.map((a) => ({ value: a.id, label: `${a.name} (${a.code ?? ""})` }))} value={form.airlineId} onChange={(e) => setForm({ ...form, airlineId: e.target.value })} error={errors.airlineId?.[0]} disabled={creating} />
        <SelectField label="Destination country" name="otb-price-country" placeholder="Select a country" options={countries.map((c) => ({ value: c.id, label: c.name }))} value={form.countryId} onChange={(e) => setForm({ ...form, countryId: e.target.value })} error={errors.countryId?.[0]} disabled={creating} />
        <SelectField label="Passenger type" name="otb-price-pax" options={(Object.keys(PAX_LABELS) as PaxType[]).map((p) => ({ value: p, label: PAX_LABELS[p] }))} value={form.paxType} onChange={(e) => setForm({ ...form, paxType: e.target.value })} error={errors.paxType?.[0]} disabled={creating} />
        <TextField label="Normal price (₹)" name="otb-price-normal" type="number" min={0} value={form.normal} onChange={(e) => setForm({ ...form, normal: e.target.value })} error={errors.normalPrice?.[0]} disabled={creating} />
        <TextField label="Urgent price (₹)" name="otb-price-urgent" type="number" min={0} placeholder="Airline price" value={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.value })} error={errors.urgentPrice?.[0]} disabled={creating} />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" isLoading={creating} disabled={!form.airlineId || !form.countryId || form.normal === ""} onClick={() => void create()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add price
        </Button>
      </div>
    </div>
  );
}

/**
 * P18 — Admin OTB pricing by airline + destination country + passenger
 * type (Developer Answers §4). Where no active row matches, the airline's
 * own normal/urgent price (Admin → Airlines) is charged.
 */
export function OtbPricesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [rows, setRows] = useState<OtbPriceData[]>([]);
  const [airlines, setAirlines] = useState<Option[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [prices, airlineList, countryList] = await Promise.all([
          getJson<OtbPriceData[]>("/api/admin/otb-prices"),
          getJson<Option[]>("/api/admin/airlines"),
          getJson<Option[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setRows(prices);
        setAirlines(airlineList.filter((a) => a.active && a.otbRequired));
        setCountries(countryList.filter((c) => c.active));
        setState("success");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") return <Skeleton className="h-64 w-full" />;
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load OTB prices"
        description="Please try again."
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <EmptyState title="No OTB prices yet" description="Until you add one, each airline's own normal / urgent price is charged." />
      ) : (
        rows.map((row) => <PriceRow key={row.id} row={row} onSaved={(updated) => setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)))} />)
      )}
      <NewPriceForm airlines={airlines} countries={countries} onCreated={(created) => setRows((current) => [...current, created])} />
    </div>
  );
}
