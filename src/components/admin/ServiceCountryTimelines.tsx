"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { ApiError, deleteJson, getJson, postJson, putJson } from "@/lib/api/client";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import {
  COUNTRY_TIMELINE_FIELD_META,
  COUNTRY_TIMELINE_FIELDS,
  COUNTRY_TIMELINE_SERVICES,
  type CountryTimelineField,
  type CountryTimelineOverride,
  type CountryTimelineRow,
  type CountryTimelineService,
} from "@/lib/settings/service-timeline-merge";

interface CountryOption {
  id: string;
  code: string;
  name: string;
}

interface LoadResult {
  rows: CountryTimelineRow[];
  countries: CountryOption[];
}

/**
 * The fields each service actually uses (the API stores every column):
 * Return Ticket has no quotation and its payment links never expire, so only
 * the SLA hours apply there. Processing days have no reader for these
 * services yet, so they stay hidden rather than look like they do something.
 */
const FIELDS_BY_SERVICE: Record<CountryTimelineService, readonly CountryTimelineField[]> = {
  RETURN_TICKET: ["documentVerificationHours", "expectedCompletionHours"],
  VISA_EXTENSION: ["documentVerificationHours", "expectedCompletionHours", "quotationResponseMinutes", "paymentDeadlineHours"],
  VISA_CHANGE: ["documentVerificationHours", "expectedCompletionHours", "quotationResponseMinutes", "paymentDeadlineHours"],
  FLIGHT_SPECIAL_FARE: ["documentVerificationHours", "expectedCompletionHours", "quotationResponseMinutes", "paymentDeadlineHours"],
};

const MAX_BY_FIELD: Record<CountryTimelineField, number> = {
  documentVerificationHours: 8760,
  expectedCompletionHours: 8760,
  quotationResponseMinutes: 525600,
  paymentDeadlineHours: 8760,
  processingDaysNormal: 90,
  processingDaysExpress: 90,
};

type Draft = Record<CountryTimelineField, string>;
const EMPTY_DRAFT: Draft = Object.fromEntries(COUNTRY_TIMELINE_FIELDS.map((field) => [field, ""])) as Draft;
const toDraft = (row: CountryTimelineRow): Draft =>
  Object.fromEntries(COUNTRY_TIMELINE_FIELDS.map((field) => [field, row[field] === null ? "" : String(row[field])])) as Draft;
const formatValue = (field: CountryTimelineField, value: number | null) =>
  value === null ? "Default" : `${value} ${COUNTRY_TIMELINE_FIELD_META[field].unit}`;

const inputClass = cn(fieldControlClass, fieldBorderClass(false), "h-9");

/**
 * Admin handover §6 — "Timeline all services country wise". Per-country
 * timelines for Return Ticket / Visa Extension / Visa Change / Special Fare,
 * below the service card in Service Configuration → Timelines. Only the
 * fields that differ are filled; a blank field uses the service value.
 */
export function ServiceCountryTimelines({ serviceType }: { serviceType: CountryTimelineService }) {
  const [data, setData] = useState<LoadResult | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ countryId: string; draft: Draft; isNew: boolean } | null>(null);
  const [copySource, setCopySource] = useState<CountryTimelineRow | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const fields = FIELDS_BY_SERVICE[serviceType];
  const label = SERVICE_TYPE_LABELS[serviceType];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError("");
      try {
        const result = await getJson<LoadResult>(`/api/admin/service-country-timelines?serviceType=${serviceType}`);
        if (!cancelled) setData(result);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof ApiError ? error.message : "Couldn't load the country timelines.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serviceType, reloadNonce]);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => row.countryName.toLowerCase().includes(term) || row.countryCode.toLowerCase().includes(term));
  }, [data, search]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

  if (loadError) {
    return (
      <ErrorState
        title="Couldn't load country timelines"
        description={loadError}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }
  if (data === null) return <Skeleton className="h-40 w-full" />;

  const usedCountryIds = new Set(data.rows.map((row) => row.countryId));
  const availableCountries = data.countries.filter((country) => !usedCountryIds.has(country.id));
  const countryName = (id: string) => data.countries.find((country) => country.id === id)?.name ?? data.rows.find((row) => row.countryId === id)?.countryName ?? "";

  const save = async () => {
    if (!editing) return;
    if (!editing.countryId) {
      toast.error("Choose a country.");
      return;
    }
    const values = {} as CountryTimelineOverride;
    for (const field of COUNTRY_TIMELINE_FIELDS) {
      const text = editing.draft[field].trim();
      // Hidden fields keep whatever is stored (normally blank).
      const value = text === "" ? null : Number(text);
      if (value !== null && (!Number.isInteger(value) || value < 0 || value > MAX_BY_FIELD[field])) {
        toast.error(`${COUNTRY_TIMELINE_FIELD_META[field].label}: enter a whole number between 0 and ${MAX_BY_FIELD[field]}, or leave it blank.`);
        return;
      }
      values[field] = value;
    }
    if (COUNTRY_TIMELINE_FIELDS.every((field) => values[field] === null)) {
      toast.error("Fill at least one timeline, or delete the country row to use the service values.");
      return;
    }
    const name = countryName(editing.countryId);
    const reason = await confirm({
      title: `${editing.isNew ? "Add" : "Update"} ${label} timeline for ${name}?`,
      description: "Leads for this country will use these timelines; blank fields keep the service value.",
      confirmLabel: "Save timeline",
    });
    if (!reason) return;
    setBusy(true);
    try {
      await putJson("/api/admin/service-country-timelines", { serviceType, countryId: editing.countryId, ...values, reason });
      toast.success(`${name} timeline saved.`);
      setEditing(null);
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the timeline.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: CountryTimelineRow) => {
    const reason = await confirm({
      title: `Remove the ${row.countryName} timeline?`,
      description: `${row.countryName} will use the ${label} service values again.`,
      confirmLabel: "Remove",
    });
    if (!reason) return;
    setBusy(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/service-country-timelines?id=${encodeURIComponent(row.id)}`, reason));
      toast.success(`${row.countryName} timeline removed.`);
      setReloadNonce((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove the timeline.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-heading">Country timelines</h3>
          <p className="text-xs text-ink-tertiary">
            Fill only what differs for a country; a blank field uses the {label} values above. Used for Delay Analysis, delay alerts, SLA
            escalation{fields.includes("paymentDeadlineHours") ? ", quote validity and payment link validity" : ""}, matched on the lead&apos;s country.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setEditing({ countryId: availableCountries[0]?.id ?? "", draft: EMPTY_DRAFT, isNew: true })}
          disabled={busy || availableCountries.length === 0}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add country
        </Button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
              Country
              {editing.isNew ? (
                <select
                  value={editing.countryId}
                  onChange={(event) => setEditing({ ...editing, countryId: event.target.value })}
                  className={inputClass}
                  disabled={busy}
                >
                  {availableCountries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex h-9 items-center text-sm font-medium text-ink-heading">{countryName(editing.countryId)}</span>
              )}
            </label>
            {fields.map((field) => (
              <label key={field} className="flex flex-col gap-1 text-xs text-ink-tertiary">
                {COUNTRY_TIMELINE_FIELD_META[field].label} ({COUNTRY_TIMELINE_FIELD_META[field].unit})
                <input
                  type="number"
                  min={0}
                  max={MAX_BY_FIELD[field]}
                  inputMode="numeric"
                  placeholder="Service default"
                  value={editing.draft[field]}
                  onChange={(event) => setEditing({ ...editing, draft: { ...editing.draft, [field]: event.target.value } })}
                  className={inputClass}
                  disabled={busy}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} isLoading={busy}>
              Save timeline
            </Button>
          </div>
        </div>
      ) : null}

      {copySource ? (
        <CopyCountryTimelinePanel
          source={copySource}
          serviceType={serviceType}
          countries={data.countries}
          onClose={() => setCopySource(null)}
          onCopied={() => {
            setCopySource(null);
            setReloadNonce((current) => current + 1);
          }}
        />
      ) : null}

      {data.rows.length === 0 ? (
        <EmptyState title="No country timelines yet" description={`Every country uses the ${label} values. Add a country to set different timelines.`} />
      ) : (
        <>
          <input
            type="search"
            aria-label="Search country timelines"
            placeholder="Search country"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            className={cn(inputClass, "w-full sm:w-64")}
          />
          {filtered.length === 0 ? (
            <EmptyState title="No matching countries" description="Try a different search." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs font-medium tracking-wide text-ink-tertiary uppercase">
                    <th className="px-3 py-2">Country</th>
                    {fields.map((field) => (
                      <th key={field} className="px-3 py-2">
                        {COUNTRY_TIMELINE_FIELD_META[field].label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => (
                    <tr key={row.id} className="border-b border-hairline last:border-0">
                      <td className="px-3 py-2 font-medium text-ink-heading">{row.countryName}</td>
                      {fields.map((field) => (
                        <td key={field} className={cn("px-3 py-2", row[field] === null ? "text-ink-tertiary" : "text-ink-primary")}>
                          {formatValue(field, row[field])}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit ${row.countryName} timeline`}
                            onClick={() => setEditing({ countryId: row.countryId, draft: toDraft(row), isNew: false })}
                            disabled={busy}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Copy ${row.countryName} timeline to other countries or services`}
                            onClick={() => setCopySource(row)}
                            disabled={busy}
                          >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Remove ${row.countryName} timeline`}
                            onClick={() => void remove(row)}
                            disabled={busy}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ListPagination noun="country" {...paginationProps} />
        </>
      )}
      {dialog}
    </section>
  );
}

/** "Copy this country timeline to…" — other countries and/or the same countries of other country-timeline services. */
function CopyCountryTimelinePanel({
  source,
  serviceType,
  countries,
  onClose,
  onCopied,
}: {
  source: CountryTimelineRow;
  serviceType: CountryTimelineService;
  countries: CountryOption[];
  onClose: () => void;
  onCopied: () => void;
}) {
  const [services, setServices] = useState<Set<CountryTimelineService>>(new Set([serviceType]));
  const [countryIds, setCountryIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const term = search.trim().toLowerCase();
  const visibleCountries = term ? countries.filter((country) => country.name.toLowerCase().includes(term)) : countries;
  const targetCount = [...services].reduce(
    (sum, service) => sum + [...countryIds].filter((id) => !(service === serviceType && id === source.countryId)).length,
    0
  );

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const submit = async () => {
    if (targetCount === 0) {
      toast.error("Choose at least one other country or service.");
      return;
    }
    const reason = await confirm({
      title: `Copy the ${source.countryName} timeline to ${targetCount} row${targetCount === 1 ? "" : "s"}?`,
      description: "Any timeline already set for a chosen service and country is replaced with these values.",
      confirmLabel: "Copy timelines",
    });
    if (!reason) return;
    setBusy(true);
    try {
      const result = await postJson<{ copied: number }>("/api/admin/service-timelines/copy", {
        mode: "COUNTRY",
        sourceServiceType: serviceType,
        sourceCountryId: source.countryId,
        targetServiceTypes: [...services],
        targetCountryIds: [...countryIds],
        reason,
      });
      toast.success(`Timeline copied to ${result.copied} row${result.copied === 1 ? "" : "s"}.`);
      onCopied();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't copy the timeline.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
      <p className="text-sm font-medium text-ink-heading">Copy the {source.countryName} timeline to…</p>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="mb-1 text-xs text-ink-tertiary">Services</legend>
        {COUNTRY_TIMELINE_SERVICES.map((service) => (
          <label key={service} className="flex items-center gap-2 text-sm text-ink-primary">
            <input type="checkbox" checked={services.has(service)} onChange={() => setServices((current) => toggle(current, service))} disabled={busy} />
            {SERVICE_TYPE_LABELS[service]}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs text-ink-tertiary">Countries ({countryIds.size} chosen)</legend>
        <input
          type="search"
          aria-label="Search countries to copy to"
          placeholder="Search country"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={cn(inputClass, "w-full sm:w-64")}
        />
        <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {visibleCountries.map((country) => (
            <label key={country.id} className="flex items-center gap-2 text-sm text-ink-primary">
              <input
                type="checkbox"
                checked={countryIds.has(country.id)}
                onChange={() => setCountryIds((current) => toggle(current, country.id))}
                disabled={busy}
              />
              {country.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} isLoading={busy} disabled={targetCount === 0}>
          Copy to {targetCount} row{targetCount === 1 ? "" : "s"}
        </Button>
      </div>
      {dialog}
    </div>
  );
}
