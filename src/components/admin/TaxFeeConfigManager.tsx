"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";

interface TaxFeeConfigData {
  gstRatePercent: string;
  gatewayFeePercent: string;
  updatedAt: string;
}

type FetchState = "loading" | "success" | "error";

export function TaxFeeConfigManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [config, setConfig] = useState<TaxFeeConfigData | null>(null);
  const [gstRatePercent, setGstRatePercent] = useState("");
  const [gatewayFeePercent, setGatewayFeePercent] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<TaxFeeConfigData>("/api/admin/tax-fee-config");
        if (cancelled) return;
        setConfig(result);
        setGstRatePercent(result.gstRatePercent);
        setGatewayFeePercent(result.gatewayFeePercent);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the tax/fee configuration. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const dirty = config != null && (gstRatePercent !== config.gstRatePercent || gatewayFeePercent !== config.gatewayFeePercent);

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<TaxFeeConfigData>("/api/admin/tax-fee-config", {
        gstRatePercent: Number(gstRatePercent),
        gatewayFeePercent: Number(gatewayFeePercent),
      });
      toast.success("Tax/fee configuration updated — new payments will use these rates.");
      setConfig(updated);
      setGstRatePercent(updated.gstRatePercent);
      setGatewayFeePercent(updated.gatewayFeePercent);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") {
    return <Skeleton className="h-48 w-full max-w-xl" />;
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load the tax/fee configuration"
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
    <div className="flex max-w-xl flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="GST / Tax Rate (%)"
          name="gstRatePercent"
          type="number"
          step="0.01"
          value={gstRatePercent}
          onChange={(event) => setGstRatePercent(event.target.value)}
          error={errors.gstRatePercent?.[0]}
          disabled={saving}
        />
        <TextField
          label="Gateway Fee Rate (%)"
          name="gatewayFeePercent"
          type="number"
          step="0.01"
          value={gatewayFeePercent}
          onChange={(event) => setGatewayFeePercent(event.target.value)}
          error={errors.gatewayFeePercent?.[0]}
          disabled={saving}
        />
      </div>
      <p className="text-xs text-ink-tertiary">
        Applied to every new payment&apos;s base amount when a booking&apos;s payment is created — see{" "}
        <code>src/app/api/bookings/[id]/payments/route.ts</code>. Existing payments already created keep their original
        amounts; only new ones use the updated rates.
      </p>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
