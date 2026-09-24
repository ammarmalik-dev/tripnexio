"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface ProtectionPlanConfigData {
  defaultPrice: string;
  termsText: string;
  eligibilityConditions: string[];
  updatedAt: string;
}

type FetchState = "loading" | "success" | "error";

export function ProtectionPlanConfigManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [config, setConfig] = useState<ProtectionPlanConfigData | null>(null);
  const [defaultPrice, setDefaultPrice] = useState("");
  const [termsText, setTermsText] = useState("");
  const [eligibilityConditions, setEligibilityConditions] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<ProtectionPlanConfigData>("/api/admin/protection-plan-config");
        if (cancelled) return;
        setConfig(result);
        setDefaultPrice(result.defaultPrice);
        setTermsText(result.termsText);
        setEligibilityConditions(result.eligibilityConditions);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the Protection Plan configuration. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const dirty =
    config != null &&
    (defaultPrice !== config.defaultPrice || termsText !== config.termsText || JSON.stringify(eligibilityConditions) !== JSON.stringify(config.eligibilityConditions));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<ProtectionPlanConfigData>("/api/admin/protection-plan-config", {
        defaultPrice: Number(defaultPrice),
        termsText,
        eligibilityConditions,
      });
      toast.success("Protection Plan configuration updated.");
      setConfig(updated);
      setDefaultPrice(updated.defaultPrice);
      setTermsText(updated.termsText);
      setEligibilityConditions(updated.eligibilityConditions);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") return <Skeleton className="h-96 w-full max-w-2xl" />;

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load the Protection Plan configuration"
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
    <div className="flex max-w-2xl flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <TextField
        label="Default Price per Eligible Passenger (₹)"
        name="defaultPrice"
        type="number"
        step="0.01"
        value={defaultPrice}
        onChange={(event) => setDefaultPrice(event.target.value)}
        error={errors.defaultPrice?.[0]}
        disabled={saving}
      />

      <Textarea
        label="Terms & Conditions"
        name="termsText"
        rows={6}
        value={termsText}
        onChange={(event) => setTermsText(event.target.value)}
        error={errors.termsText?.[0]}
        disabled={saving}
        hint="Shown to staff before a Protection Plan purchase is confirmed."
      />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink-heading">Eligibility Conditions</p>
        <ul className="flex flex-col gap-1.5">
          {eligibilityConditions.map((condition, index) => (
            <li key={index} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-1.5 text-sm text-ink-secondary">
              {condition}
              <button
                type="button"
                onClick={() => setEligibilityConditions((current) => current.filter((_, i) => i !== index))}
                disabled={saving}
                className="text-ink-tertiary hover:text-error"
                aria-label={`Remove condition: ${condition}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <TextField
            label="Add condition"
            name="newCondition"
            value={newCondition}
            onChange={(event) => setNewCondition(event.target.value)}
            disabled={saving}
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!newCondition.trim()) return;
              setEligibilityConditions((current) => [...current, newCondition.trim()]);
              setNewCondition("");
            }}
            disabled={saving || !newCondition.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      </div>

      <p className="text-xs text-ink-tertiary">
        New_Visa.md §8 — the price and eligibility list feed the Internal Dashboard Protection Plan purchase flow; changing them doesn&apos;t alter any
        already-offered or purchased plan (prices are snapshotted at offer time).
      </p>

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
