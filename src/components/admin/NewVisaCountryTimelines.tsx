"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ApiError, getJson, putJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface Row {
  countryId: string;
  countryCode: string;
  countryName: string;
  minTravelDaysNormal: number | null;
  minTravelDaysExpress: number | null;
  processingDaysNormal: number | null;
  processingDaysExpress: number | null;
}

const FIELDS = [
  { key: "processingDaysNormal", label: "Normal processing" },
  { key: "processingDaysExpress", label: "Express processing" },
  { key: "minTravelDaysNormal", label: "Normal: min days before travel" },
  { key: "minTravelDaysExpress", label: "Express: min days before travel" },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];
type Draft = Record<FieldKey, string>;

const toDraft = (row: Row): Draft =>
  Object.fromEntries(FIELDS.map(({ key }) => [key, row[key] === null ? "" : String(row[key])])) as Draft;
const toValue = (text: string): number | null => (text.trim() === "" ? null : Number(text));

/**
 * Client testing 2026-10-09 (B31) — New Visa timelines per destination
 * country, in working days. The form uses them for the Expected Approval Date
 * and to block travel dates the chosen processing type can't meet; an empty
 * cell uses the service-wide value above.
 */
export function NewVisaCountryTimelines() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<Row[]>("/api/admin/new-visa-timelines");
        if (cancelled) return;
        setRows(result);
        setDrafts(Object.fromEntries(result.map((row) => [row.countryId, toDraft(row)])));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof ApiError ? loadError.message : "Couldn't load the country timelines.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorState title="Couldn't load country timelines" description={error} />;
  if (rows === null) return <Skeleton className="h-40 w-full" />;
  if (rows.length === 0) {
    return <EmptyState title="No New Visa countries yet" description="Add a New Visa product for a country, then set its timeline here." />;
  }

  const save = async (row: Row) => {
    const draft = drafts[row.countryId];
    const values = Object.fromEntries(FIELDS.map(({ key }) => [key, toValue(draft[key])])) as Record<FieldKey, number | null>;
    if (Object.values(values).some((value) => value !== null && (!Number.isInteger(value) || value < 0 || value > 365))) {
      toast.error("Use whole working days between 0 and 365, or leave a cell empty.");
      return;
    }
    setSavingId(row.countryId);
    try {
      await putJson("/api/admin/new-visa-timelines", { countryId: row.countryId, ...values });
      setRows((current) => (current ?? []).map((entry) => (entry.countryId === row.countryId ? { ...entry, ...values } : entry)));
      toast.success(`${row.countryName} timeline saved.`);
    } catch (saveError) {
      toast.error(saveError instanceof ApiError ? saveError.message : "Couldn't save the timeline.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-heading">New Visa timeline by country</h3>
        <p className="text-xs text-ink-tertiary">
          Working days. Processing days give the Expected Approval Date; minimum days before travel block dates the option can&apos;t meet.
          Leave a cell empty to use the service-wide value.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
              <th className="px-3 py-2">Country</th>
              {FIELDS.map((field) => (
                <th key={field.key} className="px-3 py-2">
                  {field.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const draft = drafts[row.countryId];
              const dirty = FIELDS.some(({ key }) => toValue(draft[key]) !== row[key]);
              return (
                <tr key={row.countryId} className="border-b border-hairline last:border-0">
                  <td className="px-3 py-2 font-medium text-ink-heading">{row.countryName}</td>
                  {FIELDS.map(({ key, label }) => (
                    <td key={key} className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        inputMode="numeric"
                        aria-label={`${row.countryName}: ${label}`}
                        placeholder="Default"
                        value={draft[key]}
                        onChange={(event) => setDrafts((current) => ({ ...current, [row.countryId]: { ...current[row.countryId], [key]: event.target.value } }))}
                        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-28")}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <Button type="button" size="sm" onClick={() => void save(row)} disabled={!dirty} isLoading={savingId === row.countryId}>
                      Save
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
