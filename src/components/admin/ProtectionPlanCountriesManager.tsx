"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

interface CountrySetting {
  countryId: string;
  code: string;
  name: string;
  active: boolean;
  hasNewVisa: boolean;
  enabled: boolean;
  price: string | null;
  termsText: string | null;
}

type FetchState = "loading" | "success" | "error";

function CountryRow({ setting, onSaved }: { setting: CountrySetting; onSaved: (next: CountrySetting) => void }) {
  const [price, setPrice] = useState(setting.price ?? "");
  const [termsText, setTermsText] = useState(setting.termsText ?? "");
  const [showTerms, setShowTerms] = useState(false);
  const [saving, setSaving] = useState<"toggle" | "save" | null>(null);
  const { confirm, dialog } = useConfirmAction();

  const dirty = price !== (setting.price ?? "") || termsText !== (setting.termsText ?? "");
  const priceInvalid = price.trim() !== "" && !(Number(price) > 0);

  const save = async (patch: { enabled?: boolean; price?: number | null; termsText?: string | null }, kind: "toggle" | "save") => {
    // Business Rules §14 — a price change goes through the shared confirmation step; enable/disable and terms don't.
    let reason: string | undefined;
    const currentPrice = setting.price == null ? null : Number(setting.price);
    if (patch.price !== undefined && patch.price !== currentPrice) {
      const confirmed = await confirm({
        title: `Change the Protection Plan price for ${setting.name}?`,
        description: `${currentPrice === null ? "Default price" : `₹${currentPrice}`} → ${patch.price === null ? "default price" : `₹${patch.price}`}. New Protection Plans for this destination are charged the new price.`,
        confirmLabel: "Save Price",
      });
      if (!confirmed) return;
      reason = confirmed;
    }
    setSaving(kind);
    try {
      const result = await patchJson<{ enabled: boolean; price: string | null; termsText: string | null }>(
        `/api/admin/protection-plan-countries/${setting.countryId}`,
        { ...patch, reason }
      );
      onSaved({ ...setting, ...result });
      setPrice(result.price ?? "");
      setTermsText(result.termsText ?? "");
      toast.success(
        kind === "toggle" ? `Protection Plan ${result.enabled ? "enabled" : "disabled"} for ${setting.name}.` : `Saved ${setting.name}.`
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <li className="flex flex-col gap-2 border-b border-hairline py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[160px] flex-1">
          <p className="text-sm font-medium text-ink-primary">
            {setting.name} <span className="text-xs text-ink-tertiary">({setting.code})</span>
          </p>
          <p className="text-xs text-ink-tertiary">
            {setting.hasNewVisa ? "Sells New Visa" : "No New Visa options yet"}
            {!setting.active ? " · country inactive" : ""}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={setting.enabled}
            disabled={saving !== null}
            onChange={(event) => void save({ enabled: event.target.checked }, "toggle")}
            aria-label={`Offer Protection Plan for ${setting.name}`}
          />
          {setting.enabled ? "Enabled" : "Disabled"}
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-tertiary">
          Price ₹
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            placeholder="Default"
            onChange={(event) => setPrice(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(priceInvalid), "h-8 w-28 text-sm")}
            aria-label={`Protection Plan price for ${setting.name}`}
            disabled={saving !== null}
          />
        </label>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowTerms((current) => !current)}>
          {showTerms ? "Hide terms" : setting.termsText ? "Edit terms" : "Custom terms"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void save({ price: price.trim() === "" ? null : Number(price), termsText: termsText.trim() === "" ? null : termsText }, "save")}
          isLoading={saving === "save"}
          disabled={!dirty || priceInvalid || saving !== null}
        >
          Save
        </Button>
      </div>
      {showTerms ? (
        <textarea
          value={termsText}
          onChange={(event) => setTermsText(event.target.value)}
          rows={5}
          placeholder="Leave empty to use the default terms"
          aria-label={`Protection Plan terms for ${setting.name}`}
          className={cn(fieldControlClass, fieldBorderClass(false), "text-sm")}
          disabled={saving !== null}
        />
      ) : null}
      {dialog}
    </li>
  );
}

/** P12 — Admin enables/disables Protection Plan per destination country, with optional price and terms overrides. */
export function ProtectionPlanCountriesManager({ countryId }: { countryId?: string } = {}) {
  const [state, setState] = useState<FetchState>("loading");
  const [settings, setSettings] = useState<CountrySetting[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<CountrySetting[]>("/api/admin/protection-plan-countries");
        if (cancelled) return;
        setSettings(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the country settings.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") return <Skeleton className="h-64 w-full max-w-3xl" />;
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load the country settings"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  // P23 — optional `countryId` (Service Configuration hub) shows only that country's row. Absent = original filter.
  const visible = countryId
    ? settings.filter((setting) => setting.countryId === countryId)
    : showAll
      ? settings
      : settings.filter((setting) => setting.hasNewVisa || setting.enabled);

  return (
    <div className="flex max-w-3xl flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink-heading">Country-wise availability</h2>
          <p className="text-xs text-ink-tertiary">
            Offered only for enabled destination countries. Empty price or terms use the defaults below. Changes apply to new bookings only.
          </p>
        </div>
        {countryId ? null : (
          <label className="flex items-center gap-2 text-xs text-ink-secondary">
            <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
            Show all countries
          </label>
        )}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title={countryId ? "This country has no Protection Plan setting" : "No New Visa countries yet"}
          description={countryId ? "Clear the country filter to see every country." : "Tick “Show all countries” to enable Protection Plan for any country."}
        />
      ) : (
        <ul>
          {visible.map((setting) => (
            <CountryRow
              key={setting.countryId}
              setting={setting}
              onSaved={(next) => setSettings((current) => current.map((row) => (row.countryId === next.countryId ? next : row)))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
