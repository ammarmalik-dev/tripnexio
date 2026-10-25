"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

interface TaxFeeConfigData {
  gstRatePercent: string;
  gatewayFeePercent: string;
  gatewayFeeChargedToCustomer: boolean;
  updatedAt: string;
}

type FetchState = "loading" | "success" | "error";

export function TaxFeeConfigManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [config, setConfig] = useState<TaxFeeConfigData | null>(null);
  const [gstRatePercent, setGstRatePercent] = useState("");
  const [gatewayFeePercent, setGatewayFeePercent] = useState("");
  const [chargedToCustomer, setChargedToCustomer] = useState(true);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const { confirm, dialog } = useConfirmAction();

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
        setChargedToCustomer(result.gatewayFeeChargedToCustomer);
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

  const dirty =
    config != null &&
    (gstRatePercent !== config.gstRatePercent || gatewayFeePercent !== config.gatewayFeePercent || chargedToCustomer !== config.gatewayFeeChargedToCustomer);

  const handleSave = async () => {
    const reason = await confirm({
      title: "Change GST / gateway fee rates?",
      description: `GST ${config?.gstRatePercent ?? "?"}% → ${gstRatePercent}%, gateway fee ${config?.gatewayFeePercent ?? "?"}% → ${gatewayFeePercent}% (${chargedToCustomer ? "charged to the customer" : "absorbed by TripNexio"}). Every new payment will use these settings.`,
      confirmLabel: "Save Rates",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<TaxFeeConfigData>("/api/admin/tax-fee-config", {
        gstRatePercent: Number(gstRatePercent),
        gatewayFeePercent: Number(gatewayFeePercent),
        gatewayFeeChargedToCustomer: chargedToCustomer,
        reason,
      });
      toast.success("Tax/fee configuration updated — new payments will use these rates.");
      setConfig(updated);
      setGstRatePercent(updated.gstRatePercent);
      setGatewayFeePercent(updated.gatewayFeePercent);
      setChargedToCustomer(updated.gatewayFeeChargedToCustomer);
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
      {Number(config?.gstRatePercent ?? 0) > 0 ? (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm font-medium text-ink-primary">
          GST is charged on the service charge only. Make sure the business GSTIN is set in System Configuration (legal details) or Invoice Settings.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="GST / Tax Rate (%)"
          name="gstRatePercent"
          type="number"
          step="0.01"
          hint="The GST switch for the whole system: 0 = GST off everywhere. While it's on, a service's own GST % (Admin → Services) replaces this rate for that service."
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
      <label className="flex items-start gap-3 rounded-lg border border-hairline px-4 py-3">
        <input
          type="checkbox"
          checked={chargedToCustomer}
          disabled={saving}
          onChange={(event) => setChargedToCustomer(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink-primary">Charge the gateway fee to the customer</span>
          <span className="text-xs text-ink-tertiary">
            On: shown separately on the invoice and added to the payable amount. Off: the customer pays no gateway fee; it is recorded as
            our expense on each payment.
          </span>
        </span>
      </label>
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
      {dialog}
    </div>
  );
}
