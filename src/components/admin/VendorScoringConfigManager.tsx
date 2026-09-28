"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { ConfirmActionDialog } from "@/components/crm/ConfirmActionDialog";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface VendorScoringConfigData {
  serviceSuitabilityWeight: number;
  processingTimeWeight: number;
  performanceWeight: number;
  reliabilityWeight: number;
  updatedAt: string;
}

type FetchState = "loading" | "success" | "error";

export function VendorScoringConfigManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [config, setConfig] = useState<VendorScoringConfigData | null>(null);
  const [form, setForm] = useState({ serviceSuitabilityWeight: 25, processingTimeWeight: 25, performanceWeight: 25, reliabilityWeight: 25 });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<VendorScoringConfigData>("/api/admin/vendor-scoring-config");
        if (cancelled) return;
        setConfig(result);
        setForm({
          serviceSuitabilityWeight: result.serviceSuitabilityWeight,
          processingTimeWeight: result.processingTimeWeight,
          performanceWeight: result.performanceWeight,
          reliabilityWeight: result.reliabilityWeight,
        });
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the vendor scoring configuration. Please try again.");
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
    (form.serviceSuitabilityWeight !== config.serviceSuitabilityWeight ||
      form.processingTimeWeight !== config.processingTimeWeight ||
      form.performanceWeight !== config.performanceWeight ||
      form.reliabilityWeight !== config.reliabilityWeight);

  const handleConfirm = async (reason: string) => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<VendorScoringConfigData>("/api/admin/vendor-scoring-config", { ...form, reason });
      toast.success("Vendor scoring weights updated.");
      setConfig(updated);
      setShowConfirm(false);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") {
    return <Skeleton className="h-64 w-full max-w-xl" />;
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load the vendor scoring configuration"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const total = form.serviceSuitabilityWeight + form.processingTimeWeight + form.performanceWeight + form.reliabilityWeight;

  return (
    <div className="flex max-w-xl flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <p className="text-xs text-ink-tertiary">
        Business Rules §8 &quot;Vendor Selection&quot; — do not select simply the cheapest vendor. These weights combine
        with each vendor&apos;s 1-5 scores (Admin → Vendors) into one overall recommendation score shown in the quote
        builder as a sort/display aid — staff always make the final vendor choice.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Service Suitability Weight"
          name="serviceSuitabilityWeight"
          type="number"
          min={0}
          max={100}
          value={form.serviceSuitabilityWeight}
          onChange={(event) => setForm((current) => ({ ...current, serviceSuitabilityWeight: Number(event.target.value) }))}
          error={errors.serviceSuitabilityWeight?.[0]}
          disabled={saving}
        />
        <TextField
          label="Processing Time Weight"
          name="processingTimeWeight"
          type="number"
          min={0}
          max={100}
          value={form.processingTimeWeight}
          onChange={(event) => setForm((current) => ({ ...current, processingTimeWeight: Number(event.target.value) }))}
          error={errors.processingTimeWeight?.[0]}
          disabled={saving}
        />
        <TextField
          label="Performance Weight"
          name="performanceWeight"
          type="number"
          min={0}
          max={100}
          value={form.performanceWeight}
          onChange={(event) => setForm((current) => ({ ...current, performanceWeight: Number(event.target.value) }))}
          error={errors.performanceWeight?.[0]}
          disabled={saving}
        />
        <TextField
          label="Reliability Weight"
          name="reliabilityWeight"
          type="number"
          min={0}
          max={100}
          value={form.reliabilityWeight}
          onChange={(event) => setForm((current) => ({ ...current, reliabilityWeight: Number(event.target.value) }))}
          error={errors.reliabilityWeight?.[0]}
          disabled={saving}
        />
      </div>
      <p className="text-xs text-ink-tertiary">
        Total: {total}{total !== 100 ? " — needn't be exactly 100, weights are normalized automatically" : ""}
      </p>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setShowConfirm(true)} disabled={!dirty}>
          Save Changes
        </Button>
      </div>

      {showConfirm ? (
        <ConfirmActionDialog
          title="Update vendor scoring weights?"
          description="This changes how every vendor's overall recommendation score is computed going forward (Business Rules §14 — sensitive workflow/status configuration change)."
          confirmLabel="Confirm Update"
          pending={saving}
          onConfirm={(reason) => void handleConfirm(reason)}
          onCancel={() => setShowConfirm(false)}
        />
      ) : null}
    </div>
  );
}
