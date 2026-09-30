"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface GatewayStatus {
  activeProvider: "razorpay" | "mock" | "unconfigured";
  isProduction: boolean;
  mode: "test" | "live" | "unknown" | null;
  keyIdSet: boolean;
  keyIdMasked: string | null;
  keySecretSet: boolean;
  webhookSecretSet: boolean;
  webhookUrl: string;
}

interface PaymentGatewayData {
  status: GatewayStatus;
  defaultPaymentLinkHours: number | null;
  fallbackPaymentLinkHours: number;
}

type FetchState = "loading" | "success" | "error";

const PROVIDER_LABELS: Record<GatewayStatus["activeProvider"], string> = {
  razorpay: "Razorpay",
  mock: "Mock gateway (development only)",
  unconfigured: "Not configured — payments will fail",
};

const MODE_LABELS: Record<NonNullable<GatewayStatus["mode"]>, string> = {
  test: "Test mode (rzp_test_ key)",
  live: "Live mode (rzp_live_ key)",
  unknown: "Unknown (key id doesn't start with rzp_test_ or rzp_live_)",
};

function SetBadge({ set }: { set: boolean }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", set ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
      {set ? "Set" : "Not set"}
    </span>
  );
}

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-hairline py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-ink-secondary">{label}</dt>
      <dd className="text-sm font-medium text-ink-primary">{children}</dd>
    </div>
  );
}

/** P24 — Admin → Payment Gateway. Secret-free status + the one editable setting (default payment-link validity). */
export function PaymentGatewayManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [data, setData] = useState<PaymentGatewayData | null>(null);
  const [hours, setHours] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<PaymentGatewayData>("/api/admin/payment-gateway");
        if (cancelled) return;
        setData(result);
        setHours(result.defaultPaymentLinkHours == null ? "" : String(result.defaultPaymentLinkHours));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the payment gateway settings. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const savedHours = data?.defaultPaymentLinkHours == null ? "" : String(data.defaultPaymentLinkHours);
  const dirty = data != null && hours.trim() !== savedHours;

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const trimmed = hours.trim();
      const updated = await patchJson<PaymentGatewayData>("/api/admin/payment-gateway", {
        defaultPaymentLinkHours: trimmed === "" ? null : Number(trimmed),
      });
      toast.success("Default payment-link validity updated — new payment links will use it.");
      setData(updated);
      setHours(updated.defaultPaymentLinkHours == null ? "" : String(updated.defaultPaymentLinkHours));
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the setting. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Webhook URL copied.");
    } catch {
      toast.error("Couldn't copy — select the URL and copy it manually.");
    }
  };

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-64 w-full max-w-2xl" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <ErrorState
        title="Couldn't load the payment gateway settings"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const { status } = data;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section aria-labelledby="gateway-status-heading" className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-5">
        <h2 id="gateway-status-heading" className="text-sm font-semibold text-ink-heading">
          Gateway Status
        </h2>
        {status.activeProvider !== "razorpay" ? (
          <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-ink-primary">
            {status.activeProvider === "mock"
              ? "Razorpay keys aren't configured, so this environment uses the development mock gateway — no real money moves."
              : "Razorpay keys aren't configured on this production deployment — creating a payment link will fail until they are set."}
          </p>
        ) : null}
        <dl className="flex flex-col">
          <StatusRow label="Active gateway">{PROVIDER_LABELS[status.activeProvider]}</StatusRow>
          <StatusRow label="Mode">{status.mode ? MODE_LABELS[status.mode] : "—"}</StatusRow>
          <StatusRow label="Key ID (RAZORPAY_KEY_ID)">
            <span className="flex items-center gap-2">
              {status.keyIdMasked ? <code className="text-xs">{status.keyIdMasked}</code> : null}
              <SetBadge set={status.keyIdSet} />
            </span>
          </StatusRow>
          <StatusRow label="Key secret (RAZORPAY_KEY_SECRET)">
            <SetBadge set={status.keySecretSet} />
          </StatusRow>
          <StatusRow label="Webhook secret (RAZORPAY_WEBHOOK_SECRET)">
            <SetBadge set={status.webhookSecretSet} />
          </StatusRow>
          <StatusRow label="Environment">{status.isProduction ? "Production" : "Development / preview"}</StatusRow>
        </dl>
        <div className="flex flex-col gap-2 pt-2">
          <p className="text-sm text-ink-secondary">
            Webhook URL to configure in Razorpay Dashboard → Webhooks (events: payment_link.paid, payment_link.expired,
            payment_link.cancelled, payment.failed):
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 break-all rounded-md bg-ink-primary/[0.04] px-3 py-2 text-xs text-ink-primary">{status.webhookUrl}</code>
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleCopyWebhook(status.webhookUrl)}>
              Copy
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-tertiary">
          Keys and secrets live only in the server environment (.env / hosting settings) and are never shown or editable
          here. Changing them requires a redeploy.
        </p>
      </section>

      <section aria-labelledby="link-validity-heading" className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
        <h2 id="link-validity-heading" className="text-sm font-semibold text-ink-heading">
          Default Payment-Link Validity
        </h2>
        <TextField
          label="Default payment-link validity (hours)"
          name="defaultPaymentLinkHours"
          type="number"
          min={1}
          max={720}
          step={1}
          placeholder={`Leave blank for ${data.fallbackPaymentLinkHours} hours`}
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          error={errors.defaultPaymentLinkHours?.[0]}
          hint={`Used when a service has no payment deadline of its own (Admin → Timelines). Blank = ${data.fallbackPaymentLinkHours} hours.`}
          disabled={saving}
        />
        <p className="text-xs text-ink-tertiary">Applies to payment links created from now on; existing links keep their original expiry.</p>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
            Save Changes
          </Button>
        </div>
      </section>
    </div>
  );
}
