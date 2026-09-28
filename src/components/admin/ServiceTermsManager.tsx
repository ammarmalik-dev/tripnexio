"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

interface CountryOption {
  id: string;
  name: string;
}

interface TermsData {
  id: string;
  serviceType: ServiceType;
  countryId: string | null;
  country: CountryOption | null;
  version: number;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
}

function TermsRow({ terms, onSaved }: { terms: TermsData; onSaved: (t: TermsData) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = await patchJson<TermsData>(`/api/admin/service-terms/${terms.id}`, { active: !terms.active });
      toast.success(`Version ${updated.version} ${updated.active ? "enabled" : "disabled"}.`);
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update these terms. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink-primary">
            v{terms.version} · {terms.title}
          </p>
          <p className="text-xs text-ink-tertiary">
            {terms.country ? terms.country.name : "All countries"} · published {new Date(terms.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", terms.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
            {terms.active ? "Active" : "Disabled"}
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide text" : "View text"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void toggle()} isLoading={busy}>
            {terms.active ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>
      {open ? <div className="max-h-64 overflow-auto whitespace-pre-line rounded-lg bg-surface-2 p-3 text-xs text-ink-secondary">{terms.body}</div> : null}
    </div>
  );
}

function NewTermsForm({ serviceType, countries, onCreated }: { serviceType: ServiceType; countries: CountryOption[]; onCreated: (t: TermsData) => void }) {
  const [countryId, setCountryId] = useState("");
  const [title, setTitle] = useState("Terms & Conditions");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  const publish = async () => {
    setSaving(true);
    setErrors({});
    try {
      const created = await postJson<TermsData>("/api/admin/service-terms", { serviceType, countryId: countryId || null, title: title.trim(), body: body.trim() });
      toast.success(`Version ${created.version} published.`);
      onCreated(created);
      setBody("");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : "Couldn't publish these terms. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4">
      <p className="text-sm font-semibold text-ink-heading">Publish a new version</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Destination country" htmlFor="terms-country" error={errors.countryId?.[0]}>
          <select
            id="terms-country"
            value={countryId}
            disabled={saving}
            onChange={(e) => setCountryId(e.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.countryId))}
          >
            <option value="">All countries</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </FormField>
        <TextField label="Title" name="terms-title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title?.[0]} disabled={saving} />
      </div>
      <Textarea label="Terms text" name="terms-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} error={errors.body?.[0]} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void publish()} isLoading={saving} disabled={body.trim().length < 20 || title.trim().length < 3}>
          Publish version
        </Button>
      </div>
    </div>
  );
}

export function ServiceTermsManager() {
  const [serviceType, setServiceType] = useState<ServiceType>("NEW_VISA");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [items, setItems] = useState<TermsData[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [terms, countryRows] = await Promise.all([
          getJson<TermsData[]>(`/api/admin/service-terms?serviceType=${serviceType}`),
          getJson<CountryOption[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setItems(terms);
        setCountries(countryRows.map((country) => ({ id: country.id, name: country.name })));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load terms. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serviceType, reloadNonce]);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="terms-service" className="sr-only">
        Select service
      </label>
      <select
        id="terms-service"
        value={serviceType}
        onChange={(e) => setServiceType(e.target.value as ServiceType)}
        className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[220px]")}
      >
        {SERVICE_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {state === "loading" ? (
        Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load terms"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          {items.length === 0 ? (
            <EmptyState title="No terms published for this service" description="Customers agree to the general website Terms until you publish a version here." />
          ) : (
            items.map((item) => (
              <TermsRow key={item.id} terms={item} onSaved={(updated) => setItems((current) => current.map((t) => (t.id === updated.id ? updated : t)))} />
            ))
          )}
          <NewTermsForm key={serviceType} serviceType={serviceType} countries={countries} onCreated={(created) => setItems((current) => [created, ...current])} />
        </>
      )}
    </div>
  );
}
